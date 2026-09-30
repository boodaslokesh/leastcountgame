    // ============================================================
    // DECK
    // ============================================================

    function createDeck() {

        let d = [];

        for (let s of suits) {

            for (let v of values) {

                let pts = 10;

                if (v === 'A')
                    pts = 1;

                else if (!isNaN(v))
                    pts = parseInt(v);

                d.push({
                    suit:
                        s,

                    val:
                        v,

                    points:
                        pts,

                    uid:
                        Math.random()
                            .toString(36)
                            .substring(2)
                });
            }
        }

        for (
            let i = d.length - 1;
            i > 0;
            i--
        ) {

            let j =
                Math.floor(
                    Math.random() *
                    (i + 1)
                );

            [
                d[i],
                d[j]
            ] =
            [
                d[j],
                d[i]
            ];
        }

        return d;
    }

    function calculateHandSum(hand) {

        return hand.reduce(
            (acc, card) =>
                acc + card.points,
            0
        );
    }

    // ============================================================
    // START HOST GAME
    // ============================================================

    function startHostGame() {

        if (
            players.filter(
                p =>
                    p.connected !== false &&
                    !p.eliminated &&
                    p.viewOnly !== true
            ).length < 2
        ) {

            alert(
                "Need at least 2 players to start!"
            );

            return;
        }

        roundCounter = 1;
        gameHistory = [];

        let fullDeck =
            createDeck();

        players.forEach(p => {

            if (
                p.connected !== false &&
                !p.viewOnly
            ) {

                p.hand =
                    sortHandCards(
                        fullDeck.splice(
                            0,
                            cardsPerPlayer
                        )
                    );

                p.eliminated =
                    false;
            }
        });

        discardPile =
            [fullDeck.pop()];

        deck =
            fullDeck;

        currentTurnIndex = 0;
        turnPhase = 'drop';
        roundActive = true;

        updateRoomStartedStatus(
            'yes'
        );

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

        sendRealtimeMessage(
            startPayload
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

        logTicker(
            "Game started!"
        );
    }

    // ============================================================
    // GAME STATE BROADCAST
    // ============================================================

    function broadcastGameState(msg) {

        let payload = {

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
                msg
        };

        sendRealtimeMessage(
            payload
        );
    }

    // ============================================================
    // BOT
    // ============================================================

    function checkBotTurn() {

        if (
            !isSoloMode ||
            !roundActive
        )
            return;

        let currentP =
            players[currentTurnIndex];

        if (
            currentP &&
            currentP.isBot &&
            !currentP.eliminated
        ) {

            setTimeout(
                () => {
                    executeBotTurn(
                        currentP
                    );
                },
                1200
            );
        }
    }

    function executeBotTurn(bot) {

        if (
            !roundActive ||
            currentTurnIndex !==
                players.findIndex(
                    p =>
                        p.id === bot.id
                )
        )
            return;

        let botSum =
            calculateHandSum(
                bot.hand
            );

        if (
            botSum <= 5 &&
            Math.random() < 0.7
        ) {

            executeShowRound(
                bot.id
            );

            return;
        }

        let topCard =
            discardPile[
                discardPile.length - 1
            ];

        let matchCard =
            bot.hand.find(
                c =>
                    topCard &&
                    c.val ===
                    topCard.val
            );

        let dropGroup = [];

        if (matchCard) {

            dropGroup =
                bot.hand.filter(
                    c =>
                        c.val ===
                        matchCard.val
                );

        } else {

            bot.hand.sort(
                (a, b) =>
                    b.points -
                    a.points
            );

            dropGroup =
                bot.hand.filter(
                    c =>
                        c.val ===
                        bot.hand[0].val
                );
        }

        bot.hand =
            sortHandCards(
                bot.hand.filter(
                    c =>
                        !dropGroup.includes(c)
                )
            );

        dropGroup.forEach(
            c =>
                discardPile.push(c)
        );

        let matchesBoard =
            topCard &&
            (
                dropGroup[0].val ===
                topCard.val
            );

        if (matchesBoard) {

            advanceTurn();

            syncActionComplete(
                `${bot.name} matched board drop.`
            );

            checkBotTurn();

        } else {

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
                bot.hand.push(
                    deck.pop()
                );

            advanceTurn();

            syncActionComplete(
                `${bot.name} completed turn.`
            );

            checkBotTurn();
        }
    }

