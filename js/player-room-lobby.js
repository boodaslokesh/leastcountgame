    // ============================================================
    // CREATE ROOM
    // ============================================================

    function createRoom() {

        isSoloMode = false;

        myName =
            document.getElementById(
                'nickname-input'
            ).value.trim();

        if (!myName) {

            showLobbyError(
                "Please enter your nickname."
            );

            return;
        }

        maxPlayersLimit =
            parseInt(
                document.getElementById(
                    'max-players-select'
                ).value
            );

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

        isHost = true;
        myId = myClientToken;

        roomCode =
            generateShortCode();

        gameHistoryHostName = myName;

        roundActive = false;
        gameHistory = [];
        roundCounter = 0;

        players = [
            {
                id: myId,
                name: myName,
                clientToken: myClientToken,
                connected: true,
                isHost: true,
                scores: 0,
                hand: [],
                eliminated: false,
                isBot: false,

                // NEW REJOIN FIELDS
                viewOnly: false,
                rejoinPending: false
            }
        ];

        myIndex = 0;

        initRealtimeChannel(roomCode);

        document.getElementById(
            'lobby-screen'
        ).classList.add('hidden');

        document.getElementById(
            'waiting-screen'
        ).classList.remove('hidden');

        document.getElementById(
            'display-room-code'
        ).innerText =
            roomCode;

        document.getElementById(
            'max-count'
        ).innerText =
            maxPlayersLimit;

        document.getElementById(
            'display-cards-count'
        ).innerText =
            cardsPerPlayer;

        document.getElementById(
            'display-target-pts'
        ).innerText =
            targetEliminationPoints;

        document.getElementById(
            'host-controls'
        ).classList.remove('hidden');

        document.getElementById(
            'waiting-msg'
        ).classList.add('hidden');

        updateWaitingRoomUI();

        registerPublicRoom(
            'waiting',
            'no'
        );

        logTicker(
            `Room active! Code: ${roomCode}`
        );
    }

    // ============================================================
    // JOIN ROOM
    // ============================================================

    function joinRoom() {

        isSoloMode = false;

        myName =
            document.getElementById(
                'nickname-input'
            ).value.trim();

        let codeInput =
            document.getElementById(
                'join-room-input'
            ).value
            .trim()
            .toUpperCase()
            .replace(
                /[^A-Z0-9]/g,
                ''
            );

        if (
            !myName ||
            !codeInput
        ) {

            showLobbyError(
                "Enter your nickname and Room Code."
            );

            return;
        }

        const joinBtn =
            document.getElementById(
                'join-room-btn'
            );

        if (joinBtn) {

            joinBtn.disabled = true;
            joinBtn.innerText =
                "Connecting...";

            joinBtn.classList.add(
                'opacity-50',
                'bg-emerald-600'
            );

            joinBtn.classList.remove(
                'bg-amber-500'
            );
        }

        isHost = false;
        myId = myClientToken;
        roomCode = codeInput;
        gameHistory = [];

        initRealtimeChannel(roomCode);
    }

    function showLobbyError(msg) {

        const el =
            document.getElementById(
                'lobby-error'
            );

        el.innerText = msg;

        el.classList.remove(
            'hidden'
        );

        setTimeout(
            () =>
                el.classList.add(
                    'hidden'
                ),
            4500
        );
    }

    // ============================================================
    // PLAYER LIST BROADCAST
    // ============================================================

    function broadcastPlayerList() {

        sendRealtimeMessage({

            type:
                'UPDATE_PLAYERS',

            players:
                players,

            maxPlayers:
                maxPlayersLimit,

            cardsPerPlayer:
                cardsPerPlayer,

            targetPoints:
                targetEliminationPoints
        });
    }

    // ============================================================
    // WAITING ROOM UI
    // ============================================================

    function updateWaitingRoomUI() {

        document.getElementById(
            'connected-count'
        ).innerText =
            players.filter(
                p =>
                    p.connected !== false
            ).length;

        document.getElementById(
            'display-cards-count'
        ).innerText =
            cardsPerPlayer;

        document.getElementById(
            'display-target-pts'
        ).innerText =
            targetEliminationPoints;

        const ul =
            document.getElementById(
                'player-list-ul'
            );

        ul.innerHTML = '';

        players.forEach(p => {

            let li =
                document.createElement(
                    'li'
                );

            li.className =
                'bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-xl text-xs sm:text-sm flex justify-between items-center';

            let actionsHtml = '';

            if (
                isHost &&
                !p.isHost &&
                p.id !== myId
            ) {

                actionsHtml =
                    `<div class="flex space-x-1">
                        <button onclick="confirmTransferHost('${p.id}', '${p.name.replace(/'/g, "\\'")}')"
                                class="bg-amber-600/85 hover:bg-amber-600 text-white px-2 py-0.5 rounded text-[10px] font-bold transition">
                            Make Host
                        </button>

                        <button onclick="confirmRemovePlayer('${p.id}', '${p.name.replace(/'/g, "\\'")}')"
                                class="bg-rose-600/85 hover:bg-rose-600 text-white px-2 py-0.5 rounded text-[10px] font-bold transition">
                            Remove
                        </button>
                    </div>`;
            }

            let connectionStatus = '';

            if (p.rejoinPending) {

                connectionStatus =
                    ` <span class="text-amber-400">
                        (rejoin request pending)
                    </span>`;

            } else if (
                p.viewOnly
            ) {

                connectionStatus =
                    ` <span class="text-indigo-400">
                        (view only)
                    </span>`;

            } else if (
                p.connected === false
            ) {

                connectionStatus =
                    ` <span class="text-rose-400">
                        (reconnecting...)
                    </span>`;
            }

            li.innerHTML =
                `<div class="flex items-center space-x-2">
                    👤 ${p.name}
                    ${connectionStatus}

                    ${p.isHost
                        ? '<span class="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded">Host</span>'
                        : ''
                    }
                </div>
                ${actionsHtml}`;

            ul.appendChild(li);
        });
    }

    // ============================================================
    // CHAT SYSTEM
    // ============================================================

    const roomChatMessages = [];
    const seenChatMessageIds = new Set();

    function sendRoomChatMessage() {

        const inputEl =
            document.getElementById(
                'room-chat-input'
            );

        if (!inputEl) return;

        const text =
            inputEl.value.trim();

        if (!text) return;

        inputEl.value = '';

        const senderName =
            myName || "Player";

        const senderToken =
            myClientToken || myId;

        const messageId =
            `${senderToken}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        if (isSoloMode) {

            displayChatMessageLocally(
                senderName,
                text,
                messageId
            );

        } else {

            displayChatMessageLocally(
                senderName,
                text,
                messageId
            );

            sendRealtimeMessage({

                type:
                    'ROOM_CHAT_MESSAGE',

                messageId:
                    messageId,

                senderToken:
                    senderToken,

                senderName:
                    senderName,

                text:
                    text
            });
        }
    }

    function displayChatMessageLocally(
        senderName,
        text,
        messageId
    ) {

        const chatBanner =
            document.getElementById(
                'chat-messages-banner'
            );

        const historyList =
            document.getElementById(
                'chat-history-list'
            );

        if (
            !chatBanner ||
            !historyList
        )
            return;

        const safeId =
            messageId ||
            `${senderName}-${text}-${Date.now()}`;

        if (
            seenChatMessageIds.has(
                safeId
            )
        )
            return;

        seenChatMessageIds.add(
            safeId
        );

        roomChatMessages.push({
            senderName:
                senderName || 'Player',

            text:
                text || '',

            id:
                safeId
        });

        if (
            roomChatMessages.length > 3
        )
            roomChatMessages.shift();

        historyList.innerHTML = '';

        [...roomChatMessages]
            .reverse()
            .forEach(message => {

                const row =
                    document.createElement(
                        'div'
                    );

                row.className =
                    'leading-4 break-words';

                const sender =
                    document.createElement(
                        'span'
                    );

                sender.className =
                    'font-bold text-amber-300 mr-1';

                sender.textContent =
                    `${message.senderName}:`;

                const body =
                    document.createElement(
                        'span'
                    );

                body.className =
                    'text-white';

                body.textContent =
                    message.text;

                row.appendChild(sender);
                row.appendChild(body);

                historyList.appendChild(row);
            });

        chatBanner.classList.remove(
            'hidden'
        );

        chatBanner.classList.add(
            'flex'
        );
    }

