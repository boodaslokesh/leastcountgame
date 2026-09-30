    // ============================================================
    // PUBLIC ROOMS DIRECTORY
    // ============================================================

    async function refreshPublicRoomsList() {

        const container =
            document.getElementById(
                'public-rooms-container'
            );

        if (!container) return;

        try {

            const response =
                await fetch(SUPABASE_URL, {
                    method: 'GET',
                    headers: {
                        'apikey': SUPABASE_APIKEY,
                        'Authorization':
                            `Bearer ${SUPABASE_APIKEY}`,
                        'Content-Type':
                            'application/json'
                    }
                });

            if (!response.ok)
                throw new Error(
                    'Failed to fetch rooms'
                );

            let rooms =
                await response.json();

            let now =
                new Date().getTime();

            let publicRooms =
                (Array.isArray(rooms)
                    ? rooms
                    : []
                ).filter(r => {

                    if (r.status !== 'waiting')
                        return false;

                    if (
                        r.game_started === 'yes' ||
                        r.game_started === 'true'
                    )
                        return false;

                    if (r.created_at) {

                        let createdTime =
                            new Date(
                                r.created_at
                            ).getTime();

                        if (
                            !isNaN(createdTime) &&
                            now - createdTime >
                            5 * 60 * 1000
                        ) {
                            return false;
                        }
                    }

                    return true;
                });

            if (publicRooms.length === 0) {

                container.innerHTML =
                    `<p class="text-[11px] text-zinc-500 italic text-center py-2">
                        No active waiting rooms found. Create one above!
                    </p>`;

                return;
            }

            container.innerHTML = '';

            publicRooms.forEach(room => {

                let div =
                    document.createElement('div');

                div.className =
                    'bg-zinc-900 border border-zinc-800 hover:border-emerald-500/50 p-2 rounded-xl flex justify-between items-center transition cursor-pointer';

                div.onclick = () => {

                    document.getElementById(
                        'join-room-input'
                    ).value = room.join_code;

                    joinRoom();
                };

                div.innerHTML =
                    `<div>
                        <div class="text-xs font-bold text-emerald-300">
                            Room: ${room.join_code}
                            <span class="text-[10px] text-zinc-400 font-normal">
                                (${room.host_name}'s Room)
                            </span>
                        </div>
                        <div class="text-[10px] text-zinc-400">
                            Max: ${room.max_players} players • Cards: ${room.cards}
                        </div>
                    </div>
                    <span class="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-black font-bold text-[10px] rounded-lg">
                        Join
                    </span>`;

                container.appendChild(div);
            });

        } catch (e) {

            container.innerHTML =
                `<p class="text-[11px] text-zinc-500 italic text-center py-2">
                    Unable to load rooms from database.
                </p>`;
        }
    }

    async function registerPublicRoom(
        statusValue = 'waiting',
        startedValue = 'no'
    ) {

        if (
            !isHost ||
            isSoloMode ||
            !roomCode
        )
            return;

        try {

            const roomPayload = {
                id:
                    'g_' +
                    Math.random()
                        .toString(36)
                        .substring(2, 7),

                host_name:
                    myName || 'Host',

                max_players:
                    String(maxPlayersLimit),

                cards:
                    String(cardsPerPlayer),

                eliminate_points:
                    String(targetEliminationPoints),

                join_code:
                    roomCode,

                status:
                    statusValue,

                game_started:
                    startedValue,

                created_at:
                    new Date().toISOString()
            };

            await fetch(
                SUPABASE_URL,
                {
                    method: 'POST',
                    headers: {
                        'apikey':
                            SUPABASE_APIKEY,

                        'Authorization':
                            `Bearer ${SUPABASE_APIKEY}`,

                        'Content-Type':
                            'application/json',

                        'Prefer':
                            'return=representation'
                    },

                    body:
                        JSON.stringify(
                            roomPayload
                        )
                }
            );

        } catch (e) {}
    }

    async function updateRoomStartedStatus(
        startedValue = 'yes'
    ) {

        if (
            !isHost ||
            isSoloMode ||
            !roomCode
        )
            return;

        try {

            await fetch(
                `${SUPABASE_URL}?join_code=eq.${roomCode}`,
                {
                    method: 'PATCH',

                    headers: {
                        'apikey':
                            SUPABASE_APIKEY,

                        'Authorization':
                            `Bearer ${SUPABASE_APIKEY}`,

                        'Content-Type':
                            'application/json',

                        'Prefer':
                            'return=representation'
                    },

                    body:
                        JSON.stringify({
                            game_started:
                                startedValue,

                            status:
                                'active'
                        })
                }
            );

        } catch (e) {}
    }

    window.addEventListener(
        'load',
        () => {
            refreshPublicRoomsList();
        }
    );

    // ============================================================
    // NEW: REJOIN REQUEST NOTIFICATION
    // ============================================================

    function showRejoinRequestNotification(
        player
    ) {

        if (!isHost || !player)
            return;

        pendingRejoinRequest = {
            clientToken:
                player.clientToken || player.id,

            playerId:
                player.id,

            playerName:
                player.name || 'Player'
        };

        const modal =
            document.getElementById(
                'rejoin-request-modal'
            );

        const textEl =
            document.getElementById(
                'rejoin-request-text'
            );

        if (textEl) {

            textEl.innerText =
                `${player.name || 'Player'} has returned to the room and is requesting permission to rejoin.`;
        }

        modal.classList.remove('hidden');

        /*
         * Make sure only one request is shown at a time.
         */
        document.getElementById(
            'allow-view-rejoin-btn'
        ).onclick =
            () => approveRejoin('view');

        document.getElementById(
            'allow-play-rejoin-btn'
        ).onclick =
            () => approveRejoin('play');

        document.getElementById(
            'deny-rejoin-btn'
        ).onclick =
            () => approveRejoin('deny');
    }

    function closeRejoinRequestNotification() {

        const modal =
            document.getElementById(
                'rejoin-request-modal'
            );

        if (modal)
            modal.classList.add('hidden');

        pendingRejoinRequest = null;
    }

    function approveRejoin(permission) {

        if (
            !isHost ||
            !pendingRejoinRequest
        )
            return;

        const requestedToken =
            pendingRejoinRequest.clientToken;

        const player =
            players.find(p =>
                (p.clientToken || p.id) ===
                requestedToken
            );

        if (!player) {

            closeRejoinRequestNotification();

            logTicker(
                "Rejoin request player is no longer available."
            );

            return;
        }

        /*
         * DENY
         */
        if (permission === 'deny') {

            player.connected = false;
            player.viewOnly = false;
            player.rejoinPending = false;

            sendRealtimeMessage({
                type: 'REJOIN_PERMISSION_RESPONSE',

                targetToken:
                    requestedToken,

                permission:
                    'deny'
            });

            closeRejoinRequestNotification();

            broadcastPlayerList();

            if (roundActive)
                broadcastGameState(
                    `${player.name} was not allowed to rejoin.`
                );

            renderGameBoard();

            logTicker(
                `Denied rejoin request from ${player.name}.`
            );

            return;
        }

        /*
         * VIEW ONLY
         */
        if (permission === 'view') {

            player.connected = false;
            player.viewOnly = true;
            player.rejoinPending = false;

            sendRealtimeMessage({
                type:
                    'REJOIN_PERMISSION_RESPONSE',

                targetToken:
                    requestedToken,

                permission:
                    'view',

                players:
                    players,

                deck:
                    deck,

                discardPile:
                    discardPile,

                currentTurnIndex:
                    currentTurnIndex,

                turnPhase:
                    turnPhase,

                roundActive:
                    roundActive,

                gameHistory:
                    gameHistory
            });

            closeRejoinRequestNotification();

            broadcastPlayerList();

            renderGameBoard();

            logTicker(
                `${player.name} allowed to view the game only.`
            );

            return;
        }

        /*
         * ALLOW PLAY
         */
        if (permission === 'play') {

            player.connected = true;
            player.viewOnly = false;
            player.rejoinPending = false;

            sendRealtimeMessage({
                type:
                    'REJOIN_PERMISSION_RESPONSE',

                targetToken:
                    requestedToken,

                permission:
                    'play',

                players:
                    players,

                deck:
                    deck,

                discardPile:
                    discardPile,

                currentTurnIndex:
                    currentTurnIndex,

                turnPhase:
                    turnPhase,

                roundActive:
                    roundActive,

                gameHistory:
                    gameHistory
            });

            closeRejoinRequestNotification();

            broadcastPlayerList();

            if (roundActive) {

                broadcastGameState(
                    `${player.name} rejoined and was allowed to play.`
                );

            } else {

                logTicker(
                    `${player.name} was allowed to rejoin.`
                );
            }

            renderGameBoard();
        }
    }

    // ============================================================
    // EXIT GAME
    // ============================================================

    async function confirmExitGame() {

        if (!confirm(
            "Are you sure you want to exit?"
        ))
            return;

        if (
            !isSoloMode &&
            roomCode &&
            roomChannel
        ) {

            try {

                if (isHost) {

                    const leaving =
                        players.find(
                            p =>
                                p.clientToken ===
                                myClientToken ||
                                p.id === myId
                        );

                    if (leaving) {

                        leaving.connected = false;
                        leaving.viewOnly = false;
                        leaving.rejoinPending = false;
                    }

                    if (
                        roundActive &&
                        players[currentTurnIndex] &&
                        (
                            players[currentTurnIndex].clientToken === myClientToken ||
                            players[currentTurnIndex].id === myId
                        )
                    ) {

                        advanceTurn();
                    }

                    const successor =
                        players.find(
                            p =>
                                (p.clientToken || p.id) !==
                                myClientToken &&
                                p.connected !== false &&
                                !p.eliminated
                        );

                    if (successor) {

                        await sendRealtimeMessage({

                            type:
                                'HOST_LEFT',

                            newHostToken:
                                successor.clientToken ||
                                successor.id,

                            players:
                                players,

                            currentTurnIndex:
                                currentTurnIndex,

                            turnPhase:
                                turnPhase,

                            deck:
                                deck,

                            discardPile:
                                discardPile,

                            gameHistoryHostName:
                                gameHistoryHostName,

                            roundActive:
                                roundActive
                        });
                    }

                } else {

                    await sendRealtimeMessage({
                        type:
                            'PLAYER_LEFT',

                        clientToken:
                            myClientToken
                    });
                }

            } catch (e) {}
        }

        try {

            if (roomChannel)
                await supabaseClient.removeChannel(
                    roomChannel
                );

        } catch (e) {}

        try {
            if (roomChannel) await supabaseClient.removeChannel(roomChannel);
        } catch (e) {}
        roomChannel = null;
        try { localStorage.removeItem('leastCountGameSession'); } catch (e) {}
        isHost = false;
        isSoloMode = false;
        myId = '';
        roomCode = '';
        players = [];
        myIndex = 0;
        gameHistory = [];
        roundCounter = 0;
        deck = [];
        discardPile = [];
        currentTurnIndex = 0;
        roundActive = false;
        turnPhase = 'drop';
        pendingRejoinRequest = null;
        document.getElementById('lobby-screen').classList.remove('hidden');
        document.getElementById('waiting-screen').classList.add('hidden');
        document.getElementById('game-board-screen').classList.add('hidden');
        document.getElementById('room-badge').classList.add('hidden');
        document.getElementById('sticky-scores-wrapper').classList.add('hidden');
        document.getElementById('game-status-banner').classList.add('hidden');
        document.getElementById('rejoin-request-modal').classList.add('hidden');
        document.getElementById('history-modal').classList.add('hidden');
        document.getElementById('scoreboard-modal').classList.add('hidden');
        document.getElementById('round-over-modal').classList.add('hidden');
        document.getElementById('lobby-error').classList.add('hidden');
        logTicker('Ready');
        refreshPublicRoomsList();
    }

    // ============================================================
    // REMOVE PLAYER
    // ============================================================

    function confirmRemovePlayer(
        targetPeerId,
        targetPlayerName
    ) {

        if (
            confirm(
                `Are you sure you want to remove this player (${targetPlayerName})?`
            )
        ) {

            players =
                players.filter(
                    p =>
                        p.id !== targetPeerId
                );

            sendRealtimeMessage({
                type:
                    'KICKED_PLAYER',

                kickedId:
                    targetPeerId
            });

            broadcastPlayerList();

            if (roundActive) {

                if (
                    currentTurnIndex >=
                    players.length
                )
                    currentTurnIndex = 0;

                broadcastGameState(
                    "Player removed by host."
                );
            }

            updateWaitingRoomUI();
            renderGameBoard();

            logTicker(
                `Removed ${targetPlayerName} from the game.`
            );
        }
    }

    // ============================================================
    // TRANSFER HOST
    // ============================================================

    function confirmTransferHost(
        targetPeerId,
        targetPlayerName
    ) {

        if (
            confirm(
                `Are you sure you want to make ${targetPlayerName} the host?`
            )
        ) {

            players.forEach(p => {

                p.isHost =
                    (
                        p.id === targetPeerId ||
                        p.clientToken === targetPeerId
                    );
            });

            let newHost =
                players.find(
                    p => p.isHost
                );

            if (newHost) {

                isHost =
                    (
                        newHost.clientToken ===
                        myClientToken ||
                        newHost.id === myId
                    );
            }

            sendRealtimeMessage({

                type:
                    'HOST_TRANSFERRED',

                newHostToken:
                    newHost
                        ? (
                            newHost.clientToken ||
                            newHost.id
                        )
                        : null,

                players:
                    players,

                gameHistoryHostName:
                    gameHistoryHostName
            });

            updateWaitingRoomUI();
            renderGameBoard();

            logTicker(
                `Transferred host to ${targetPlayerName}.`
            );
        }
    }

    // ============================================================
    // MODALS
    // ============================================================

    function toggleScoreboardModal(show) {

        document.getElementById(
            'scoreboard-modal'
        ).classList.toggle(
            'hidden',
            !show
        );

        if (show) {

            document.getElementById(
                'modal-standings-title'
            ).innerText =
                `Tournament Standings (Max ${targetEliminationPoints})`;

            updateScoreboardTable();
        }
    }

    function toggleInstructionsModal(show) {
        const modal = document.getElementById('instructions-modal');
        if (!modal) return;
        modal.classList.toggle('hidden', !show);
    }

    function toggleHistoryModal(show) {

        document.getElementById(
            'history-modal'
        ).classList.toggle(
            'hidden',
            !show
        );

        if (show)
            updateHistoryContainer();
    }

    function closeRoundOverModal() {

        document.getElementById(
            'round-over-modal'
        ).classList.add('hidden');
    }

    function generateShortCode() {

        const chars =
            'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

        let code = '';

        for (let i = 0; i < 6; i++) {

            code +=
                chars.charAt(
                    Math.floor(
                        Math.random() *
                        chars.length
                    )
                );
        }

        return code;
    }

    function resetJoinButtonState(success) {

        const btn =
            document.getElementById(
                'join-room-btn'
            );

        if (btn) {

            btn.disabled = false;
            btn.innerText = "Join Code";

            btn.classList.remove(
                'opacity-50',
                'bg-emerald-600'
            );

            btn.classList.add(
                'bg-amber-500'
            );
        }
    }

    // ============================================================
    // SOLO MODE
    // ============================================================

    function startSoloGame() {

        myName =
            document.getElementById(
                'nickname-input'
            ).value.trim() ||
            "Player";

        cardsPerPlayer =
            parseInt(
                document.getElementById(
                    'cards-count-select'
                ).value
            );

        targetEliminationPoints =
            parseInt(
                document.getElementById(
                    'target-points-select'
                ).value
            );

        maxPlayersLimit =
            parseInt(
                document.getElementById(
                    'max-players-select'
                ).value
            );

        isSoloMode = true;
        isHost = true;

        myId = 'player-me';
        roomCode = 'SOLO';
        gameHistoryHostName = myName;

        gameHistory = [];
        roundCounter = 0;

        players = [
            {
                id: myId,
                name: myName,
                isHost: true,
                scores: 0,
                hand: [],
                eliminated: false,
                isBot: false,
                connected: true,
                viewOnly: false,
                rejoinPending: false
            }
        ];

        for (
            let i = 1;
            i < maxPlayersLimit;
            i++
        ) {

            players.push({
                id: `bot-${i}`,
                name: `Bot ${i}`,
                isHost: false,
                scores: 0,
                hand: [],
                eliminated: false,
                isBot: true,
                connected: true,
                viewOnly: false,
                rejoinPending: false
            });
        }

        myIndex = 0;

        let fullDeck =
            createDeck();

        players.forEach(p => {

            p.hand =
                sortHandCards(
                    fullDeck.splice(
                        0,
                        cardsPerPlayer
                    )
                );

            p.eliminated = false;
        });

        discardPile =
            [fullDeck.pop()];

        deck =
            fullDeck;

        currentTurnIndex = 0;
        turnPhase = 'drop';
        roundActive = true;

        document.getElementById(
            'lobby-screen'
        ).classList.add('hidden');

        document.getElementById(
            'game-board-screen'
        ).classList.remove('hidden');

        document.getElementById(
            'room-badge'
        ).classList.add('hidden');

        document.getElementById(
            'sticky-scores-wrapper'
        ).classList.remove('hidden');

        document.getElementById(
            'game-status-banner'
        ).classList.remove('hidden');

        document.getElementById(
            'game-status-banner'
        ).innerText =
            "Solo vs Computer Mode";

        renderGameBoard();

        logTicker(
            "Solo game started against Computer bots!"
        );

        checkBotTurn();
    }

