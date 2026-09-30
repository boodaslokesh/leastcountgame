    // ============================================================
    // CARD CLICK
    // ============================================================

    function handleCardClick(cardUid) {

        if (!roundActive)
            return;

        if (
            currentTurnIndex !==
            myIndex
        )
            return;

        let me =
            players[myIndex];

        /*
         * NEW:
         * View-only players cannot interact.
         */
        if (
            me.eliminated ||
            me.viewOnly === true ||
            me.connected === false
        )
            return;

        if (turnPhase === 'drop') {

            let cardIndex =
                me.hand.findIndex(
                    c =>
                        c.uid ===
                        cardUid
                );

            if (cardIndex === -1)
                return;

            let selectedCard =
                me.hand[cardIndex];

            let droppedCards =
                me.hand.filter(
                    c =>
                        c.val ===
                        selectedCard.val
                );

            me.hand =
                sortHandCards(
                    me.hand.filter(
                        c =>
                            c.val !==
                            selectedCard.val
                    )
                );

            let previousTopCard =
                discardPile[
                    discardPile.length - 1
                ];

            droppedCards.forEach(
                c =>
                    discardPile.push(c)
            );

            let matchesBoard =
                previousTopCard &&
                (
                    selectedCard.val ===
                    previousTopCard.val
                );

            if (matchesBoard) {

                turnPhase =
                    'drop';

                advanceTurn();

                syncActionComplete(
                    `${me.name} dropped matching board card.`
                );

                checkBotTurn();

            } else {

                turnPhase =
                    'draw';

                renderGameBoard();

                logTicker(
                    "Card dropped. Click stock deck to draw."
                );
            }
        }
    }

    // ============================================================
    // DRAW
    // ============================================================

    function drawFromDeck() {

        if (!roundActive)
            return;

        if (
            currentTurnIndex !==
            myIndex
        )
            return;

        let me =
            players[myIndex];

        /*
         * NEW:
         * View-only / disconnected players cannot draw.
         */
        if (
            me.viewOnly === true ||
            me.connected === false ||
            me.eliminated
        )
            return;

        if (
            turnPhase !== 'draw'
        )
            return;

        if (
            deck.length === 0 &&
            discardPile.length > 1
        ) {

            let top =
                discardPile.pop();

            deck =
                discardPile;

            discardPile =
                [top];
        }

        if (deck.length > 0)
            me.hand.push(
                deck.pop()
            );

        turnPhase =
            'drop';

        advanceTurn();

        syncActionComplete(
            `${me.name} drew a card.`
        );

        checkBotTurn();
    }

    // ============================================================
    // ADVANCE TURN
    // ============================================================

    function advanceTurn() {

        if (!players.length)
            return;

        let attempts = 0;

        do {

            currentTurnIndex =
                (
                    currentTurnIndex +
                    1
                ) %
                players.length;

            attempts++;

        } while (
            attempts <
                players.length &&
            (
                !players[currentTurnIndex] ||
                players[currentTurnIndex].eliminated ||
                players[currentTurnIndex].connected === false ||
                players[currentTurnIndex].viewOnly === true ||
                players[currentTurnIndex].rejoinPending === true
            )
        );
    }

    // ============================================================
    // ACTION SYNC
    // ============================================================

    function syncActionComplete(msg) {

        if (isHost) {

            if (!isSoloMode)
                broadcastGameState(msg);

            renderGameBoard();

            logTicker(msg);

        } else {

            /*
             * Extra protection:
             * A view-only player cannot send a game action.
             */
            let me =
                players[myIndex];

            if (
                me &&
                (
                    me.viewOnly === true ||
                    me.connected === false
                )
            )
                return;

            sendRealtimeMessage({

                type:
                    'PLAYER_ACTION',

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
                    msg
            });
        }
    }

    function handleHostAction(data) {

        /*
         * Verify the player that sent the action is actually
         * allowed to play.
         */
        let actionPlayer =
            data.players &&
            data.players.find(
                p =>
                    (
                        p.clientToken ||
                        p.id
                    ) ===
                    (
                        data.clientToken ||
                        data.senderId
                    )
            );

        /*
         * Preserve the existing behavior when the identity
         * is not supplied by the older action payload.
         */
        if (
            actionPlayer &&
            (
                actionPlayer.viewOnly === true ||
                actionPlayer.connected === false
            )
        )
            return;

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

        broadcastGameState(
            data.message
        );

        renderGameBoard();

        logTicker(
            data.message
        );
    }

    // ============================================================
    // CALL SHOW
    // ============================================================

    function callShow() {

        let me =
            players[myIndex];

        if (!me)
            return;

        /*
         * NEW:
         * View-only players cannot call Show.
         */
        if (
            me.viewOnly === true ||
            me.connected === false
        )
            return;

        if (
            currentTurnIndex !==
            myIndex ||
            turnPhase !== 'drop'
        )
            return;

        let sum =
            calculateHandSum(
                me.hand
            );

        if (sum > 5) {

            alert(
                "Sum must be 5 or less!"
            );

            return;
        }

        if (
            isHost ||
            isSoloMode
        ) {

            executeShowRound(
                myId
            );

        } else {

            sendRealtimeMessage({

                type:
                    'CALL_SHOW',

                peerId:
                    myId
            });
        }
    }

    function handleHostShowCall(
        callerPeerId
    ) {

        /*
         * NEW:
         * Do not accept Show from a view-only
         * or disconnected player.
         */
        let caller =
            players.find(
                p =>
                    p.id ===
                        callerPeerId ||
                    p.clientToken ===
                        callerPeerId
            );

        if (
            !caller ||
            caller.viewOnly === true ||
            caller.connected === false
        )
            return;

        executeShowRound(
            callerPeerId
        );
    }

    // ============================================================
    // SHOW ROUND
    // ============================================================

    function executeShowRound(
        callerPeerId
    ) {

        let caller =
            players.find(
                p =>
                    p.id ===
                        callerPeerId ||
                    p.clientToken ===
                        callerPeerId
            );

        if (!caller)
            return;

        if (
            caller.viewOnly === true ||
            caller.connected === false
        )
            return;

        let callerSum =
            calculateHandSum(
                caller.hand
            );

        let summaries = [];

        players.forEach(p => {

            if (
                !p.eliminated &&
                p.connected !== false &&
                p.viewOnly !== true
            ) {

                summaries.push({
                    player:
                        p,

                    sum:
                        calculateHandSum(
                            p.hand
                        )
                });
            }
        });

        let resultsText =
            `<strong>${caller.name}</strong> called SHOW with sum: <strong>${callerSum}</strong>!<br><br>`;

        let roundRecord = {

            roundNumber:
                roundCounter++,

            callerName:
                caller.name,

            callerSum:
                callerSum,

            details:
                []
        };

        let lowerPlayers =
            summaries.filter(
                item =>
                    item.player.id !==
                        caller.id &&
                    item.sum <
                        callerSum
            );

        if (
            lowerPlayers.length > 0
        ) {

            resultsText +=
                `<span class="text-rose-400 font-bold">
                    FAILED SHOW! Someone had a lower count.
                </span><br>`;

            caller.scores += 25;

            roundRecord.outcome =
                "Failed Show (+25 penalty)";

            summaries.forEach(
                item => {

                    let ptsAdded =
                        (
                            item.player.id ===
                            caller.id
                        )
                            ? 25
                            : 0;

                    roundRecord.details.push({
                        name:
                            item.player.name,

                        sum:
                            item.sum,

                        pointsAdded:
                            ptsAdded
                    });
                }
            );

        } else {

            let equalPlayers =
                summaries.filter(
                    item =>
                        item.player.id !==
                            caller.id &&
                        item.sum ===
                            callerSum
                );

            if (
                equalPlayers.length > 0
            ) {

                resultsText +=
                    `<span class="text-amber-400 font-bold">
                        MATCHED SHOW!
                    </span><br>`;

                let matchedIds =
                    [
                        caller.id,
                        ...equalPlayers.map(
                            m =>
                                m.player.id
                        )
                    ];

                roundRecord.outcome =
                    "Matched Show";

                summaries.forEach(
                    item => {

                        let ptsAdded = 0;

                        if (
                            !matchedIds.includes(
                                item.player.id
                            )
                        ) {

                            item.player.scores +=
                                item.sum;

                            ptsAdded =
                                item.sum;
                        }

                        roundRecord.details.push({
                            name:
                                item.player.name,

                            sum:
                                item.sum,

                            pointsAdded:
                                ptsAdded
                        });
                    }
                );

            } else {

                resultsText +=
                    `<span class="text-emerald-400 font-bold">
                        GOOD SHOW!
                    </span><br>`;

                roundRecord.outcome =
                    "Good Show";

                summaries.forEach(
                    item => {

                        let ptsAdded = 0;

                        if (
                            item.player.id !==
                            caller.id
                        ) {

                            item.player.scores +=
                                item.sum;

                            ptsAdded =
                                item.sum;
                        }

                        roundRecord.details.push({
                            name:
                                item.player.name,

                            sum:
                                item.sum,

                            pointsAdded:
                                ptsAdded
                        });
                    }
                );
            }
        }

        gameHistory.push(
            roundRecord
        );

        resultsText +=
            `<hr class="border-zinc-800 my-2">
             <div class="text-xs space-y-1">`;

        summaries.forEach(
            item => {

                resultsText +=
                    `<div>
                        ${item.player.name}:
                        Sum = <strong>${item.sum}</strong>
                        |
                        Total = <strong>${item.player.scores}</strong>
                    </div>`;
            }
        );

        resultsText +=
            `</div>`;

        players.forEach(p => {

            if (
                p.scores >=
                targetEliminationPoints
            )
                p.eliminated =
                    true;
        });

        // Capture each player's running score as part of the round history snapshot.
        if (gameHistory.length) {
            const latestRound = gameHistory[gameHistory.length - 1];
            latestRound.details.forEach(detail => {
                const detailPlayer = players.find(p => p.name === detail.name);
                if (detailPlayer) detail.totalAfterRound = detailPlayer.scores;
            });
        }

        roundActive = false;

        const remainingPlayers = players.filter(
            p =>
                !p.eliminated &&
                p.connected !== false &&
                p.viewOnly !== true
        );

        const roundWinner =
            remainingPlayers.length === 1
                ? remainingPlayers[0].name
                : '';

        // Persist the complete game history after every completed round.
        // Only the host writes, and the same host + game code updates the existing row.
        syncGameHistoryToSupabase(roundWinner);

        let payload = {

            type:
                'ROUND_OVER',

            resultsData:
                resultsText,

            callerName:
                caller.name,

            players:
                players,

            gameHistory:
                gameHistory
        };

        showRoundOverModal(
            resultsText,
            caller.name
        );

        renderGameBoard();

        if (
            isHost &&
            !isSoloMode
        ) {

            sendRealtimeMessage(
                payload
            );
        }
    }

    function showRoundOverModal(
        htmlContent,
        callerName
    ) {

        document.getElementById(
            'round-over-title'
        ).innerText =
            `${callerName.toUpperCase()} CALLED SHOW!`;

        document.getElementById(
            'round-over-content'
        ).innerHTML =
            htmlContent;

        document.getElementById(
            'round-over-modal'
        ).classList.remove(
            'hidden'
        );

        document.getElementById(
            'host-next-round-container'
        ).classList.remove(
            'hidden'
        );

        document.getElementById(
            'waiting-next-round-msg'
        ).classList.add(
            'hidden'
        );

        document.getElementById(
            'waiting-next-round-msg'
        ).innerText =
            "Any connected player can start the next round.";
    }

    // ============================================================
    // NEXT ROUND
    // ============================================================

    async function startNextRound() {

        if (
            !isHost &&
            !isSoloMode
        ) {

            /*
             * View-only player cannot start a round.
             */
            let me =
                players[myIndex];

            if (
                me &&
                (
                    me.viewOnly === true ||
                    me.connected === false
                )
            )
                return;

            sendRealtimeMessage({
                type:
                    'START_NEXT_ROUND_REQUEST',

                clientToken:
                    myClientToken
            });

            document.getElementById(
                'waiting-next-round-msg'
            ).classList.remove(
                'hidden'
            );

            document.getElementById(
                'waiting-next-round-msg'
            ).innerText =
                "Requesting next round...";

            return;
        }

        let activePlayers =
            players.filter(
                p =>
                    !p.eliminated &&
                    p.connected !== false &&
                    p.viewOnly !== true
            );

        if (
            activePlayers.length <= 1
        ) {

            const finalWinner =
                activePlayers[0] ? activePlayers[0].name : 'Nobody';

            // Final update writes the winner into the same database row.
            await syncGameHistoryToSupabase(finalWinner);

            alert(
                `Tournament Over! Winner is ${finalWinner}!`
            );

            location.reload();

            return;
        }

        let fullDeck =
            createDeck();

        players.forEach(p => {

            if (
                !p.eliminated &&
                p.connected !== false &&
                p.viewOnly !== true
            ) {

                p.hand =
                    sortHandCards(
                        fullDeck.splice(
                            0,
                            cardsPerPlayer
                        )
                    );
            }
        });

        discardPile =
            [fullDeck.pop()];

        deck =
            fullDeck;

        roundActive = true;
        turnPhase = 'drop';

        // Rotate the opening player each round (round-robin by seat order).
        // roundCounter is incremented when the previous round is recorded,
        // so round 2 starts from seat index 1, round 3 from index 2, etc.
        const eligiblePlayers = players.map((player, index) => ({ player, index }))
            .filter(({ player }) =>
                !player.eliminated &&
                player.connected !== false &&
                player.viewOnly !== true
            );

        if (eligiblePlayers.length) {
            const firstSeat = isSoloMode
                ? Math.max(0, roundCounter) % Math.max(1, players.length)
                : Math.max(0, roundCounter - 1) % Math.max(1, players.length);

            let starter = -1;
            for (let offset = 0; offset < players.length; offset++) {
                const candidateIndex = (firstSeat + offset) % players.length;
                if (eligiblePlayers.some(({ index }) => index === candidateIndex)) {
                    starter = candidateIndex;
                    break;
                }
            }
            currentTurnIndex = starter >= 0 ? starter : eligiblePlayers[0].index;
        } else {
            currentTurnIndex = 0;
        }

        let startPayload = {

            type:
                'START_GAME',

            players:
                players,

            deck:
                deck,

            discardPile:
                discardPile,

            currentTurnIndex:
                currentTurnIndex,

            targetPoints:
                targetEliminationPoints,

            cardsPerPlayer:
                cardsPerPlayer,

            gameHistory:
                gameHistory
        };

        document.getElementById(
            'round-over-modal'
        ).classList.add(
            'hidden'
        );

        if (!isSoloMode) {

            sendRealtimeMessage(
                startPayload
            );
        }

        renderGameBoard();

        logTicker(
            "New round started!"
        );

        checkBotTurn();
    }

