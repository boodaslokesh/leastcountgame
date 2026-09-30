    // ============================================================
    // SUPABASE CLIENT & REALTIME CHANNEL INITIALIZATION
    // ============================================================

    const SUPABASE_BASE_URL = 'https://hmfeeaejffcbqyihshre.supabase.co';
    const SUPABASE_URL = `${SUPABASE_BASE_URL}/rest/v1/least-count`;
    const SUPABASE_APIKEY = 'sb_publishable_8FANdKPFeAUoNKll-Gcldg_xtMTO5ND';

    // ============================================================
    // GAME HISTORY DATABASE
    // ============================================================

    const GAME_HISTORY_URL = `${SUPABASE_BASE_URL}/rest/v1/least_count_game_history`;
    let gameHistoryHostName = '';

    function getGameHistoryHostName() {
        if (gameHistoryHostName) return gameHistoryHostName;

        const hostPlayer = players.find(p => p && p.isHost);
        gameHistoryHostName =
            (hostPlayer && hostPlayer.name) ||
            myName ||
            'Host';

        return gameHistoryHostName;
    }

    function buildGameHistoryText(finalWinner = '') {
        const hostName = getGameHistoryHostName();
        const safePlayers = Array.isArray(players) ? players : [];

        let text =
            `=== GAME START ===\n` +
            `Host: ${hostName}\n` +
            `Game Code: ${roomCode}\n` +
            `Players: ${safePlayers.map(p => p.name).join(', ')}\n` +
            `Settings: ${maxPlayersLimit} players, ${cardsPerPlayer} cards/player, ${targetEliminationPoints} elimination points\n\n`;

        if (Array.isArray(gameHistory) && gameHistory.length) {
            gameHistory.forEach(round => {
                text += `[ROUND ${round.roundNumber}]\n`;
                text += `- Caller: ${round.callerName || 'N/A'}\n`;
                text += `- Caller Sum: ${round.callerSum ?? 'N/A'}\n`;
                text += `- Outcome: ${round.outcome || 'N/A'}\n`;

                if (Array.isArray(round.details)) {
                    round.details.forEach(detail => {
                        text += `- ${detail.name}: Hand Sum = ${detail.sum}, Points Added = ${detail.pointsAdded}, Total Score = ${detail.totalAfterRound ?? 'N/A'}\n`;
                    });
                }

                text += `\n`;
            });
        }

        if (finalWinner) {
            text += `=== FINAL RESULT ===\n`;
            text += `Winner: ${finalWinner}\n`;
        } else {
            text += `=== FINAL RESULT ===\n`;
            text += `Winner: In Progress\n`;
        }

        return text.trim();
    }

    function buildGameHistoryPayload(finalWinner = '') {
        const safePlayers = Array.isArray(players) ? players : [];

        return {
            game_host: getGameHistoryHostName(),
            game_code: roomCode,
            game_winner: finalWinner || '',
            players_name: safePlayers.map(p => p.name).join(', '),
            game_points: safePlayers
                .map(p => `${p.name}: ${p.scores || 0} pts`)
                .join(', '),
            game_history: buildGameHistoryText(finalWinner)
        };
    }

    async function syncGameHistoryToSupabase(finalWinner = '') {
        if (!isHost || !roomCode) return;

        try {
            const payload = buildGameHistoryPayload(finalWinner);
            const query =
                `?game_host=eq.${encodeURIComponent(payload.game_host)}` +
                `&game_code=eq.${encodeURIComponent(payload.game_code)}` +
                `&select=id`;

            const lookupResponse = await fetch(
                `${GAME_HISTORY_URL}${query}`,
                {
                    method: 'GET',
                    headers: {
                        'apikey': SUPABASE_APIKEY,
                        'Authorization': `Bearer ${SUPABASE_APIKEY}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (!lookupResponse.ok) {
                throw new Error('Failed to check game history record');
            }

            const existingRows = await lookupResponse.json();

            if (Array.isArray(existingRows) && existingRows.length > 0) {
                const id = existingRows[0].id;

                await fetch(
                    `${GAME_HISTORY_URL}?id=eq.${encodeURIComponent(id)}`,
                    {
                        method: 'PATCH',
                        headers: {
                            'apikey': SUPABASE_APIKEY,
                            'Authorization': `Bearer ${SUPABASE_APIKEY}`,
                            'Content-Type': 'application/json',
                            'Prefer': 'return=representation'
                        },
                        body: JSON.stringify(payload)
                    }
                );
            } else {
                await fetch(
                    GAME_HISTORY_URL,
                    {
                        method: 'POST',
                        headers: {
                            'apikey': SUPABASE_APIKEY,
                            'Authorization': `Bearer ${SUPABASE_APIKEY}`,
                            'Content-Type': 'application/json',
                            'Prefer': 'return=representation'
                        },
                        body: JSON.stringify(payload)
                    }
                );
            }
        } catch (error) {
            console.error('Game history sync failed:', error);
        }
    }
    const nicknameInput = document.getElementById('nickname-input');
    try { nicknameInput.value = localStorage.getItem('leastCountNickname') || ''; } catch (e) {}
    nicknameInput.addEventListener('input', () => { try { localStorage.setItem('leastCountNickname', nicknameInput.value); } catch (e) {} });

    const supabaseClient = supabase.createClient(
        SUPABASE_BASE_URL,
        SUPABASE_APIKEY
    );

    let roomChannel = null;

    let isHost = false;
    let isSoloMode = false;
    let myId = '';
    let myName = '';
    let myClientToken = '';

    try {
        myClientToken =
            sessionStorage.getItem('leastCountClientToken') || '';

        if (!myClientToken) {
            myClientToken =
                'client-' +
                Math.random().toString(36).slice(2) +
                Date.now().toString(36);

            sessionStorage.setItem(
                'leastCountClientToken',
                myClientToken
            );
        }
    } catch (e) {
        myClientToken =
            'client-' +
            Math.random().toString(36).slice(2) +
            Date.now().toString(36);
    }

    let maxPlayersLimit = 4;
    let cardsPerPlayer = 7;
    let targetEliminationPoints = 100;
    let roomCode = '';

    let players = [];
    let myIndex = 0;
    let gameHistory = [];
    let roundCounter = 0;

    let deck = [];
    let discardPile = [];
    let currentTurnIndex = 0;
    let roundActive = false;
    let turnPhase = 'drop';

    const suits = ['♠', '♣', '♥', '♦'];
    const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

    // ============================================================
    // NEW: REJOIN REQUEST STATE
    // ============================================================

    let pendingRejoinRequest = null;

    /*
     * Important:
     *
     * connected = true
     *     Player is eligible to participate.
     *
     * connected = false
     *     Player is not eligible for turns.
     *
     * viewOnly = true
     *     Player is allowed to see the game but cannot play.
     *
     * rejoinPending = true
     *     Player has requested permission and is waiting for host.
     */

    function getPlayerToken(player) {
        if (!player) return '';
        return player.clientToken || player.id || '';
    }

    function isMePlayer(player) {
        if (!player) return false;

        return (
            player.clientToken === myClientToken ||
            player.id === myId
        );
    }

    function isPlayerAllowedToPlay(player) {
        return !!(
            player &&
            player.connected !== false &&
            player.viewOnly !== true &&
            player.rejoinPending !== true &&
            !player.eliminated
        );
    }

    // ============================================================
    // REALTIME MESSAGING WRAPPER
    // ============================================================

    function sendRealtimeMessage(payload) {
        if (roomChannel) {
            return roomChannel.send({
                type: 'broadcast',
                event: 'game_event',
                payload: payload
            });
        }
    }

    function initRealtimeChannel(code) {
        if (roomChannel) {
            supabaseClient.removeChannel(roomChannel);
        }

        roomChannel = supabaseClient.channel(`room_${code}`, {
            config: {
                broadcast: {
                    self: true
                }
            }
        });

        roomChannel
            .on(
                'broadcast',
                { event: 'game_event' },
                ({ payload }) => {
                    handleIncomingNetworkData(payload);
                }
            )
            .subscribe((status) => {

                if (status === 'SUBSCRIBED') {

                    if (!isHost && !isSoloMode) {

                        /*
                         * Existing player:
                         * DO NOT automatically reconnect.
                         *
                         * The host must approve the rejoin.
                         */
                        sendRealtimeMessage({
                            type: 'JOIN_REQUEST',
                            name: myName,
                            clientToken: myClientToken,
                            senderId: myClientToken,
                            rejoinRequest: true
                        });
                    }
                }
            });
    }

    // ============================================================
    // PULL TO REFRESH
    // ============================================================

    let touchStartY = 0;
    let isPulling = false;

    const ptrIndicator =
        document.getElementById('ptr-indicator');

    const ptrText =
        document.getElementById('ptr-text');

    window.addEventListener(
        'touchstart',
        (e) => {

            let lobbyScreen =
                document.getElementById('lobby-screen');

            if (
                lobbyScreen &&
                !lobbyScreen.classList.contains('hidden') &&
                lobbyScreen.scrollTop <= 5
            ) {
                touchStartY = e.touches[0].clientY;
                isPulling = true;
            }
        },
        { passive: true }
    );

    window.addEventListener(
        'touchmove',
        (e) => {

            if (!isPulling) return;

            let touchY = e.touches[0].clientY;
            let diff = touchY - touchStartY;

            if (diff > 0 && diff < 160) {

                ptrIndicator.style.transform =
                    `translateY(${diff - 48}px)`;

                if (diff > 75) {
                    ptrText.innerText =
                        "Release to refresh!";
                } else {
                    ptrText.innerText =
                        "Pull down to refresh...";
                }
            }
        },
        { passive: true }
    );

    window.addEventListener(
        'touchend',
        (e) => {

            if (!isPulling) return;

            isPulling = false;

            let touchY =
                e.changedTouches[0].clientY;

            let diff =
                touchY - touchStartY;

            ptrIndicator.style.transform =
                'translateY(-100%)';

            if (diff > 75) {

                ptrText.innerText =
                    "Refreshing...";

                setTimeout(
                    () => location.reload(),
                    200
                );
            }
        }
    );

    const cardValueWeight = {
        'A': 1,
        '2': 2,
        '3': 3,
        '4': 4,
        '5': 5,
        '6': 6,
        '7': 7,
        '8': 8,
        '9': 9,
        '10': 10,
        'J': 11,
        'Q': 12,
        'K': 13
    };

    function sortHandCards(hand) {

        const counts = {};

        hand.forEach(c => {
            counts[c.val] =
                (counts[c.val] || 0) + 1;
        });

        return hand.sort((a, b) => {

            let countDiff =
                (counts[b.val] || 0) -
                (counts[a.val] || 0);

            if (countDiff !== 0)
                return countDiff;

            let valDiff =
                (cardValueWeight[a.val] || 0) -
                (cardValueWeight[b.val] || 0);

            if (valDiff !== 0)
                return valDiff;

            return a.suit.localeCompare(b.suit);
        });
    }

    function logTicker(msg) {
        document.getElementById(
            'activity-log-ticker'
        ).innerText = msg;
    }

