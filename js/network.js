    // ============================================================
    // INCOMING NETWORK DATA
    // ============================================================

    function handleIncomingNetworkData(data) {

        // ========================================================
        // HOST SIDE
        // ========================================================

        if (isHost) {

            // ----------------------------------------------------
            // EXISTING PLAYER / NEW PLAYER JOIN REQUEST
            // ----------------------------------------------------

            if (data.type === 'JOIN_REQUEST') {

                let existingPlayer =
                    players.find(
                        p =>
                            p.clientToken ===
                                data.clientToken ||
                            p.id ===
                                data.clientToken
                    );

                /*
                 * NEW FEATURE:
                 *
                 * If the player already exists in the room,
                 * this is a REJOIN request.
                 *
                 * Do not automatically reconnect them.
                 */
                if (existingPlayer) {

                    /*
                     * If the player is already connected,
                     * keep existing behavior.
                     */
                    if (
                        existingPlayer.connected !== false &&
                        !existingPlayer.rejoinPending
                    ) {

                        existingPlayer.connected =
                            true;

                        existingPlayer.viewOnly =
                            false;

                        broadcastPlayerList();

                        updateWaitingRoomUI();

                        if (roundActive) {

                            sendRealtimeMessage({

                                type:
                                    'GAME_STATE_UPDATE',

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

                                message:
                                    `${existingPlayer.name} is already connected.`
                            });

                        } else {

                            logTicker(
                                `${existingPlayer.name} rejoined.`
                            );
                        }

                        return;
                    }

                    /*
                     * PLAYER IS EXITED.
                     *
                     * Store the request but keep player
                     * disconnected until host decides.
                     */
                    existingPlayer.rejoinPending =
                        true;

                    existingPlayer.connected =
                        false;

                    /*
                     * Keep previous hand, score,
                     * elimination status and all
                     * existing game information.
                     */
                    showRejoinRequestNotification(
                        existingPlayer
                    );

                    updateWaitingRoomUI();

                    logTicker(
                        `${existingPlayer.name} is requesting permission to rejoin.`
                    );

                    return;
                }

                /*
                 * If game has already started, a player who
                 * does not already exist cannot join.
                 */
                if (roundActive) {

                    sendRealtimeMessage({

                        type:
                            'REJECT',

                        targetToken:
                            data.clientToken,

                        reason:
                            'Game already started. Only previous players can request rejoin.'
                    });

                    return;
                }

                if (
                    players.length >=
                    maxPlayersLimit
                ) {

                    sendRealtimeMessage({

                        type:
                            'REJECT',

                        targetToken:
                            data.clientToken,

                        reason:
                            'Room is full.'
                    });

                    return;
                }

                /*
                 * BRAND NEW PLAYER.
                 *
                 * Existing behavior remains the same.
                 */
                let newPlayer = {

                    id:
                        data.clientToken,

                    name:
                        data.name || 'Player',

                    clientToken:
                        data.clientToken,

                    connected:
                        true,

                    isHost:
                        false,

                    scores:
                        0,

                    hand:
                        [],

                    eliminated:
                        false,

                    isBot:
                        false,

                    viewOnly:
                        false,

                    rejoinPending:
                        false
                };

                players.push(
                    newPlayer
                );

                broadcastPlayerList();

                updateWaitingRoomUI();

                logTicker(
                    `${newPlayer.name} joined.`
                );
            }

            // ----------------------------------------------------
            // PLAYER ACTION
            // ----------------------------------------------------

            else if (
                data.type ===
                'PLAYER_ACTION'
            ) {

                handleHostAction(data);
            }

            // ----------------------------------------------------
            // CALL SHOW
            // ----------------------------------------------------

            else if (
                data.type ===
                'CALL_SHOW'
            ) {

                handleHostShowCall(
                    data.peerId
                );
            }

            // ----------------------------------------------------
            // CHAT
            // ----------------------------------------------------

            else if (
                data.type ===
                'ROOM_CHAT_MESSAGE'
            ) {

                if (
                    data.forwardedByHost
                )
                    return;

                displayChatMessageLocally(
                    data.senderName,
                    data.text,
                    data.messageId
                );

                if (
                    data.senderToken !==
                    myClientToken
                ) {

                    sendRealtimeMessage({
                        ...data,
                        forwardedByHost:
                            true
                    });
                }
            }

            // ----------------------------------------------------
            // PLAYER LEFT
            // ----------------------------------------------------

            else if (
                data.type ===
                'PLAYER_LEFT'
            ) {

                const leaving =
                    players.find(
                        p =>
                            p.clientToken ===
                                data.clientToken ||
                            p.id ===
                                data.clientToken
                    );

                if (leaving) {

                    leaving.connected =
                        false;

                    leaving.viewOnly =
                        false;

                    leaving.rejoinPending =
                        false;

                    if (
                        roundActive &&
                        players[currentTurnIndex] &&
                        (
                            players[currentTurnIndex].clientToken ===
                                data.clientToken ||
                            players[currentTurnIndex].id ===
                                data.clientToken
                        )
                    ) {

                        advanceTurn();
                    }

                    broadcastPlayerList();

                    if (roundActive) {

                        broadcastGameState(
                            `${leaving.name} exited. Continuing without them.`
                        );
                    }

                    updateWaitingRoomUI();
                    renderGameBoard();
                }
            }

            // ----------------------------------------------------
            // NEXT ROUND REQUEST
            // ----------------------------------------------------

            else if (
                data.type ===
                'START_NEXT_ROUND_REQUEST'
            ) {

                if (!roundActive)
                    startNextRound();
            }

            return;
        }

        // ========================================================
        // GUEST SIDE
        // ========================================================

        switch (data.type) {

            // ----------------------------------------------------
            // REJECT
            // ----------------------------------------------------

            case 'REJECT':

                if (
                    data.targetToken ===
                    myClientToken
                ) {

                    resetJoinButtonState(
                        false
                    );

                    showLobbyError(
                        "Rejected: " +
                        data.reason
                    );
                }

                break;

            // ----------------------------------------------------
            // KICKED
            // ----------------------------------------------------

            case 'KICKED_PLAYER':

                if (
                    data.kickedId ===
                    myClientToken
                ) {

                    alert(
                        "You were removed by host."
                    );

                    location.reload();
                }

                break;

            // ----------------------------------------------------
            // NEW REJOIN PERMISSION RESPONSE
            // ----------------------------------------------------

            case 'REJOIN_PERMISSION_RESPONSE':

                /*
                 * Only the requested player handles this.
                 */
                if (
                    data.targetToken !==
                    myClientToken
                )
                    break;

                if (
                    data.permission ===
                    'deny'
                ) {

                    showLobbyError(
                        "The host denied your rejoin request."
                    );

                    resetJoinButtonState(
                        false
                    );

                    try {
                        if (roomChannel)
                            supabaseClient.removeChannel(
                                roomChannel
                            );
                    } catch (e) {}

                    setTimeout(
                        () => location.reload(),
                        1200
                    );

                    break;
                }

                /*
                 * Host allowed VIEW ONLY.
                 */
                if (
                    data.permission ===
                    'view'
                ) {

                    players =
                        data.players ||
                        players;

                    deck =
                        data.deck ||
                        deck;

                    discardPile =
                        data.discardPile ||
                        discardPile;

                    if (
                        data.currentTurnIndex !==
                        undefined
                    )
                        currentTurnIndex =
                            data.currentTurnIndex;

                    if (
                        data.turnPhase !==
                        undefined
                    )
                        turnPhase =
                            data.turnPhase;

                    if (
                        data.roundActive !==
                        undefined
                    )
                        roundActive =
                            data.roundActive;

                    gameHistory =
                        data.gameHistory ||
                        gameHistory;

                    myIndex =
                        players.findIndex(
                            p =>
                                p.id ===
                                myId ||
                                p.clientToken ===
                                myClientToken
                        );

                    let me =
                        players[myIndex];

                    if (me) {

                        me.connected =
                            false;

                        me.viewOnly =
                            true;

                        me.rejoinPending =
                            false;
                    }

                    document.getElementById(
                        'lobby-screen'
                    ).classList.add(
                        'hidden'
                    );

                    document.getElementById(
                        'waiting-screen'
                    ).classList.add(
                        'hidden'
                    );

                    document.getElementById(
                        'game-board-screen'
                    ).classList.remove(
                        'hidden'
                    );

                    document.getElementById(
                        'room-badge'
                    ).classList.remove(
                        'hidden'
                    );

                    document.getElementById(
                        'sticky-scores-wrapper'
                    ).classList.remove(
                        'hidden'
                    );

                    document.getElementById(
                        'current-room-id'
                    ).innerText =
                        roomCode;

                    document.getElementById(
                        'game-status-banner'
                    ).classList.remove(
                        'hidden'
                    );

                    document.getElementById(
                        'game-status-banner'
                    ).innerText =
                        "View Only Mode";

                    renderGameBoard();

                    logTicker(
                        "Host allowed you to view the game only."
                    );

                    break;
                }

                /*
                 * Host allowed PLAY.
                 */
                if (
                    data.permission ===
                    'play'
                ) {

                    players =
                        data.players ||
                        players;

                    deck =
                        data.deck ||
                        deck;

                    discardPile =
                        data.discardPile ||
                        discardPile;

                    if (
                        data.currentTurnIndex !==
                        undefined
                    )
                        currentTurnIndex =
                            data.currentTurnIndex;

                    if (
                        data.turnPhase !==
                        undefined
                    )
                        turnPhase =
                            data.turnPhase;

                    if (
                        data.roundActive !==
                        undefined
                    )
                        roundActive =
                            data.roundActive;

                    gameHistory =
                        data.gameHistory ||
                        gameHistory;

                    myIndex =
                        players.findIndex(
                            p =>
                                p.id ===
                                myId ||
                                p.clientToken ===
                                myClientToken
                        );

                    let me =
                        players[myIndex];

                    if (me) {

                        me.connected =
                            true;

                        me.viewOnly =
                            false;

                        me.rejoinPending =
                            false;
                    }

                    document.getElementById(
                        'lobby-screen'
                    ).classList.add(
                        'hidden'
                    );

                    document.getElementById(
                        'waiting-screen'
                    ).classList.add(
                        'hidden'
                    );

                    document.getElementById(
                        'game-board-screen'
                    ).classList.remove(
                        'hidden'
                    );

                    document.getElementById(
                        'room-badge'
                    ).classList.remove(
                        'hidden'
                    );

                    document.getElementById(
                        'sticky-scores-wrapper'
                    ).classList.remove(
                        'hidden'
                    );

                    document.getElementById(
                        'current-room-id'
                    ).innerText =
                        roomCode;

                    document.getElementById(
                        'game-status-banner'
                    ).classList.remove(
                        'hidden'
                    );

                    document.getElementById(
                        'game-status-banner'
                    ).innerText =
                        "Playing";

                    renderGameBoard();

                    logTicker(
                        "Host allowed you to continue playing."
                    );

                    break;
                }

                break;

            // ----------------------------------------------------
            // HOST TRANSFERRED
            // ----------------------------------------------------

            case 'HOST_TRANSFERRED':

                players =
                    data.players ||
                    players;

                if (data.gameHistoryHostName)
                    gameHistoryHostName = data.gameHistoryHostName;

                players.forEach(p => {

                    p.isHost =
                        (
                            p.clientToken ||
                            p.id
                        ) ===
                        data.newHostToken;
                });

                isHost =
                    data.newHostToken ===
                    myClientToken;

                if (isHost) {

                    document.getElementById(
                        'host-controls'
                    ).classList.remove(
                        'hidden'
                    );

                    logTicker(
                        "You are now the host of this room!"
                    );

                } else {

                    document.getElementById(
                        'host-controls'
                    ).classList.add(
                        'hidden'
                    );

                    logTicker(
                        "Room host has been updated."
                    );
                }

                updateWaitingRoomUI();
                renderGameBoard();

                break;

            // ----------------------------------------------------
            // HOST LEFT
            // ----------------------------------------------------

            case 'HOST_LEFT':

                players =
                    data.players ||
                    players;

                if (data.gameHistoryHostName)
                    gameHistoryHostName = data.gameHistoryHostName;

                if (
                    data.currentTurnIndex !==
                    undefined
                )
                    currentTurnIndex =
                        data.currentTurnIndex;

                if (
                    data.turnPhase !==
                    undefined
                )
                    turnPhase =
                        data.turnPhase;

                if (data.deck)
                    deck =
                        data.deck;

                if (data.discardPile)
                    discardPile =
                        data.discardPile;

                if (
                    data.roundActive !==
                    undefined
                )
                    roundActive =
                        data.roundActive;

                players.forEach(p => {

                    p.isHost =
                        (
                            p.clientToken ||
                            p.id
                        ) ===
                        data.newHostToken;
                });

                isHost =
                    data.newHostToken ===
                    myClientToken;

                if (isHost) {

                    const me =
                        players.find(
                            p =>
                                p.clientToken ===
                                    myClientToken ||
                                p.id ===
                                    myId
                        );

                    if (me) {

                        me.isHost = true;
                        me.connected = true;
                    }

                    document.getElementById(
                        'host-controls'
                    ).classList.remove(
                        'hidden'
                    );

                    logTicker(
                        "Host exited. You are now managing this room."
                    );

                } else {

                    document.getElementById(
                        'host-controls'
                    ).classList.add(
                        'hidden'
                    );

                    logTicker(
                        "Host exited. Room host transferred."
                    );
                }

                updateWaitingRoomUI();
                renderGameBoard();

                break;

            // ----------------------------------------------------
            // UPDATE PLAYERS
            // ----------------------------------------------------

            case 'UPDATE_PLAYERS':

                players =
                    data.players;

                maxPlayersLimit =
                    data.maxPlayers;

                cardsPerPlayer =
                    data.cardsPerPlayer ||
                    cardsPerPlayer;

                targetEliminationPoints =
                    data.targetPoints;

                resetJoinButtonState(
                    true
                );

                document.getElementById(
                    'lobby-screen'
                ).classList.add(
                    'hidden'
                );

                document.getElementById(
                    'waiting-screen'
                ).classList.remove(
                    'hidden'
                );

                document.getElementById(
                    'display-room-code'
                ).innerText =
                    roomCode;

                document.getElementById(
                    'max-count'
                ).innerText =
                    maxPlayersLimit;

                updateWaitingRoomUI();

                break;

            // ----------------------------------------------------
            // START GAME
            // ----------------------------------------------------

            case 'START_GAME':

                players =
                    data.players;

                deck =
                    data.deck;

                discardPile =
                    data.discardPile;

                currentTurnIndex =
                    data.currentTurnIndex;

                cardsPerPlayer =
                    data.cardsPerPlayer ||
                    cardsPerPlayer;

                targetEliminationPoints =
                    data.targetPoints ||
                    targetEliminationPoints;

                gameHistory =
                    data.gameHistory ||
                    gameHistory;

                roundActive = true;

                myIndex =
                    players.findIndex(
                        p =>
                            p.id ===
                            myId ||
                            p.clientToken ===
                            myClientToken
                    );

                document.getElementById(
                    'waiting-screen'
                ).classList.add(
                    'hidden'
                );

                document.getElementById(
                    'round-over-modal'
                ).classList.add(
                    'hidden'
                );

                document.getElementById(
                    'game-board-screen'
                ).classList.remove(
                    'hidden'
                );

                document.getElementById(
                    'room-badge'
                ).classList.remove(
                    'hidden'
                );

                document.getElementById(
                    'sticky-scores-wrapper'
                ).classList.remove(
                    'hidden'
                );

                document.getElementById(
                    'current-room-id'
                ).innerText =
                    roomCode;

                document.getElementById(
                    'game-status-banner'
                ).classList.remove(
                    'hidden'
                );

                renderGameBoard();

                break;

            // ----------------------------------------------------
            // GAME STATE UPDATE
            // ----------------------------------------------------

            case 'GAME_STATE_UPDATE':

                players =
                    data.players;

                deck =
                    data.deck;

                discardPile =
                    data.discardPile;

                currentTurnIndex =
                    data.currentTurnIndex;

                turnPhase =
                    data.turnPhase;

                roundActive = true;

                myIndex =
                    players.findIndex(
                        p =>
                            p.id ===
                            myId ||
                            p.clientToken ===
                            myClientToken
                    );

                document.getElementById(
                    'waiting-screen'
                ).classList.add(
                    'hidden'
                );

                document.getElementById(
                    'lobby-screen'
                ).classList.add(
                    'hidden'
                );

                document.getElementById(
                    'game-board-screen'
                ).classList.remove(
                    'hidden'
                );

                document.getElementById(
                    'round-over-modal'
                ).classList.add(
                    'hidden'
                );

                document.getElementById(
                    'room-badge'
                ).classList.remove(
                    'hidden'
                );

                document.getElementById(
                    'sticky-scores-wrapper'
                ).classList.remove(
                    'hidden'
                );

                document.getElementById(
                    'current-room-id'
                ).innerText =
                    roomCode;

                document.getElementById(
                    'game-status-banner'
                ).classList.remove(
                    'hidden'
                );

                /*
                 * Keep View Only status based on the
                 * player's synchronized player object.
                 */
                let syncedMe =
                    players[myIndex];

                if (
                    syncedMe &&
                    syncedMe.viewOnly === true
                ) {

                    document.getElementById(
                        'game-status-banner'
                    ).innerText =
                        "View Only Mode";

                } else {

                    document.getElementById(
                        'game-status-banner'
                    ).innerText =
                        "Playing";
                }

                renderGameBoard();

                logTicker(
                    data.message
                );

                break;

            // ----------------------------------------------------
            // CHAT
            // ----------------------------------------------------

            case 'ROOM_CHAT_MESSAGE':

                displayChatMessageLocally(
                    data.senderName,
                    data.text,
                    data.messageId
                );

                break;

            // ----------------------------------------------------
            // ROUND OVER
            // ----------------------------------------------------

            case 'ROUND_OVER':

                players =
                    data.players ||
                    players;

                gameHistory =
                    data.gameHistory ||
                    gameHistory;

                roundActive = false;

                myIndex =
                    players.findIndex(
                        p =>
                            p.id ===
                            myId ||
                            p.clientToken ===
                            myClientToken
                    );

                showRoundOverModal(
                    data.resultsData,
                    data.callerName
                );

                renderGameBoard();

                break;
        }
    }

