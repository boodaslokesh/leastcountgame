    // ============================================================
    // RENDER GAME BOARD
    // ============================================================

    function renderGameBoard() {

        const topScoresContainer =
            document.getElementById(
                'top-scores-container'
            );

        topScoresContainer.innerHTML =
            '';

        players.forEach(p => {

            let badge =
                document.createElement(
                    'div'
                );

            badge.className =
                `flex items-center space-x-1 px-2 py-0.5 rounded bg-zinc-900 border ${
                    p.eliminated
                        ? 'border-zinc-900 opacity-50'
                        : 'border-zinc-800'
                } text-[11px]`;

            badge.innerHTML =
                `<span class="font-bold text-zinc-300">
                    ${p.name}:
                </span>

                <span class="font-mono text-amber-300 font-bold">
                    ${p.scores}
                </span>`;

            topScoresContainer.appendChild(
                badge
            );
        });

        const hudContainer =
            document.getElementById(
                'opponents-hud'
            );

        hudContainer.innerHTML =
            '';

        players.forEach(
            (p, idx) => {

                if (idx === myIndex)
                    return;

                let isTurn =
                    (
                        idx ===
                        currentTurnIndex
                    );

                let div =
                    document.createElement(
                        'div'
                    );

                div.className =
                    `p-2 rounded-lg border flex flex-col justify-between transition ${
                        isTurn
                            ? 'bg-zinc-900 border-amber-400'
                            : 'bg-black border-zinc-800'
                    } ${
                        p.eliminated
                            ? 'opacity-40'
                            : ''
                    }`;

                let actionsHtml = '';

                if (
                    isHost &&
                    !p.isHost &&
                    p.id !== myId
                ) {

                    actionsHtml =
                        `<div class="flex space-x-1 mt-1">
                            <button onclick="confirmTransferHost('${p.id}', '${p.name.replace(/'/g, "\\'")}')"
                                    class="bg-amber-600 text-white px-1.5 py-0.5 rounded text-[9px]">
                                Host
                            </button>

                            <button onclick="confirmRemovePlayer('${p.id}', '${p.name.replace(/'/g, "\\'")}')"
                                    class="bg-rose-600 text-white px-1.5 py-0.5 rounded text-[9px]">
                                Remove
                            </button>
                        </div>`;
                }

                let statusText = '';

                if (
                    p.viewOnly === true
                ) {

                    statusText =
                        `<span class="text-indigo-400 text-[8px]">
                            VIEW
                        </span>`;

                } else if (
                    p.rejoinPending === true
                ) {

                    statusText =
                        `<span class="text-amber-400 text-[8px]">
                            REJOIN
                        </span>`;

                } else if (
                    p.connected === false
                ) {

                    statusText =
                        `<span class="text-rose-400 text-[8px]">
                            OFFLINE
                        </span>`;
                }

                div.innerHTML =
                    `<div class="flex justify-between items-center text-[10px]">
                        <span class="font-bold truncate max-w-[65px]">
                            ${p.name}
                        </span>

                        <span class="flex items-center gap-1">
                            ${statusText}

                            ${
                                p.isHost
                                    ? '<span class="text-[9px] text-amber-400">Host</span>'
                                    : ''
                            }
                        </span>
                    </div>

                    <div class="flex justify-between items-center text-[10px] mt-1 text-zinc-400">
                        <span>Cards:</span>
                        <span class="font-bold text-white">
                            ${p.hand ? p.hand.length : 0}
                        </span>
                    </div>

                    ${actionsHtml}`;

                hudContainer.appendChild(
                    div
                );
            }
        );

        if (
            discardPile.length > 0
        ) {

            let topCard =
                discardPile[
                    discardPile.length - 1
                ];

            let isRed =
                ['♥', '♦'].includes(
                    topCard.suit
                );

            let boardEl =
                document.getElementById(
                    'board-card-container'
                );

            boardEl.className =
                `w-14 h-20 sm:w-18 sm:h-26 bg-white border-2 border-slate-300 rounded-lg shadow-lg flex flex-col justify-between p-1.5 font-bold transition ${
                    isRed
                        ? 'text-rose-600'
                        : 'text-slate-900'
                }`;

            document.getElementById(
                'board-val-tl'
            ).innerText =
                topCard.val;

            document.getElementById(
                'board-suit-mid'
            ).innerText =
                topCard.suit;

            document.getElementById(
                'board-val-br'
            ).innerText =
                topCard.val;
        }

        document.getElementById(
            'deck-count'
        ).innerText =
            deck.length;

        let me =
            players[myIndex];

        if (!me)
            return;

        const myHandContainer =
            document.getElementById(
                'my-hand-cards'
            );

        myHandContainer.innerHTML =
            '';

        let mySum =
            calculateHandSum(
                me.hand || []
            );

        document.getElementById(
            'my-hand-sum'
        ).innerText =
            mySum;

        let displayName =
            me.name;

        if (me.eliminated) {

            displayName +=
                ' (Out)';

        } else if (
            me.viewOnly === true
        ) {

            displayName +=
                ' (View Only)';

        } else if (
            me.connected === false
        ) {

            displayName +=
                ' (Offline)';
        }

        document.getElementById(
            'my-display-name'
        ).innerText =
            displayName;

        /*
         * NEW:
         * View-only player can see everything but
         * cannot use Call Show.
         */
        let canShow =
            (
                currentTurnIndex ===
                    myIndex &&
                turnPhase ===
                    'drop' &&
                mySum <= 5 &&
                !me.eliminated &&
                me.connected !== false &&
                me.viewOnly !== true &&
                me.rejoinPending !== true
            );

        document.getElementById(
            'call-show-btn'
        ).disabled =
            !canShow;

        let activePlayer =
            players[currentTurnIndex];

        let isMyTurn =
            (
                currentTurnIndex ===
                myIndex
            );

        /*
         * View-only status message.
         */
        if (
            me.viewOnly === true
        ) {

            document.getElementById(
                'turn-announcement'
            ).innerText =
                "👁 VIEW ONLY";

            document.getElementById(
                'action-instruction'
            ).innerText =
                "You can watch the game, but cannot play.";

        } else if (
            me.connected === false
        ) {

            document.getElementById(
                'turn-announcement'
            ).innerText =
                "OFFLINE";

            document.getElementById(
                'action-instruction'
            ).innerText =
                "Waiting for rejoin permission.";

        } else {

            document.getElementById(
                'turn-announcement'
            ).innerText =
                isMyTurn
                    ? "👉 YOUR TURN!"
                    : `Turn: ${activePlayer ? activePlayer.name : 'Waiting'}`;

            document.getElementById(
                'action-instruction'
            ).innerText =
                isMyTurn
                    ? (
                        turnPhase === 'drop'
                            ? "Select card to drop."
                            : "Click stock to draw."
                    )
                    : "Waiting...";
        }

        /*
         * NEW:
         * Disable stock deck for view-only users.
         */
        const stockDeck =
            document.getElementById(
                'stock-deck'
            );

        if (stockDeck) {

            if (
                me.viewOnly === true ||
                me.connected === false ||
                !isMyTurn
            ) {

                stockDeck.classList.add(
                    'opacity-60',
                    'cursor-not-allowed'
                );

            } else {

                stockDeck.classList.remove(
                    'opacity-60',
                    'cursor-not-allowed'
                );
            }
        }

        me.hand.forEach(
            card => {

                let isRed =
                    ['♥', '♦'].includes(
                        card.suit
                    );

                let cardEl =
                    document.createElement(
                        'div'
                    );

                cardEl.className =
                    `w-12 h-20 sm:w-16 sm:h-24 bg-white border-2 border-slate-300 rounded-lg shadow-md flex flex-col justify-between p-1 sm:p-1.5 font-bold cursor-pointer hover:-translate-y-1 transition transform select-none shrink-0 ${
                        isRed
                            ? 'text-rose-600'
                            : 'text-slate-900'
                    } ${
                        !isMyTurn ||
                        me.eliminated ||
                        me.viewOnly === true ||
                        me.connected === false
                            ? 'opacity-80 cursor-not-allowed'
                            : ''
                    }`;

                cardEl.innerHTML =
                    `<div class="text-[10px] sm:text-xs">
                        ${card.val}
                    </div>

                    <div class="text-sm sm:text-lg self-center">
                        ${card.suit}
                    </div>

                    <div class="text-[10px] sm:text-xs self-end rotate-180">
                        ${card.val}
                    </div>`;

                /*
                 * NEW:
                 * View-only cards never receive click handlers.
                 */
                if (
                    isMyTurn &&
                    !me.eliminated &&
                    me.viewOnly !== true &&
                    me.connected !== false
                ) {

                    cardEl.onclick =
                        () =>
                            handleCardClick(
                                card.uid
                            );
                }

                myHandContainer.appendChild(
                    cardEl
                );
            }
        );
    }

    // ============================================================
    // SCOREBOARD
    // ============================================================

    function updateScoreboardTable() {

        const tbody =
            document.getElementById(
                'scoreboard-table-body'
            );

        tbody.innerHTML =
            '';

        players.forEach(p => {

            let tr =
                document.createElement(
                    'tr'
                );

            let status =
                p.eliminated
                    ? 'Eliminated'
                    : p.viewOnly
                        ? 'View Only'
                        : p.connected === false
                            ? 'Offline'
                            : 'Active';

            let statusClass =
                p.eliminated
                    ? 'bg-rose-500/20 text-rose-400'
                    : p.viewOnly
                        ? 'bg-indigo-500/20 text-indigo-400'
                        : p.connected === false
                            ? 'bg-zinc-500/20 text-zinc-400'
                            : 'bg-emerald-500/20 text-emerald-400';

            tr.innerHTML =
                `<td class="py-2 font-medium">
                    ${p.name}
                    ${
                        p.isHost
                            ? '<span class="text-[10px] text-amber-400 font-normal">(Host)</span>'
                            : ''
                    }
                </td>

                <td class="py-2 text-right font-mono font-bold">
                    ${p.scores} / ${targetEliminationPoints}
                </td>

                <td class="py-2 text-right text-[11px]">
                    <span class="px-2 py-0.5 rounded ${statusClass}">
                        ${status}
                    </span>
                </td>`;

            tbody.appendChild(
                tr
            );
        });
    }

    // ============================================================
    // HISTORY
    // ============================================================

    function updateHistoryContainer() {

        const container =
            document.getElementById(
                'history-container'
            );

        if (!container)
            return;

        if (
            !gameHistory ||
            gameHistory.length === 0
        ) {

            container.innerHTML =
                `<p class="text-zinc-500 italic text-center py-4">
                    No completed rounds yet.
                </p>`;

            return;
        }

        container.innerHTML =
            '';

        gameHistory.forEach(
            round => {

                let div =
                    document.createElement(
                        'div'
                    );

                div.className =
                    'bg-zinc-900 border border-zinc-800 p-3 rounded-xl space-y-1.5';

                let detailsHtml =
                    '';

                round.details.forEach(
                    d => {

                        detailsHtml +=
                            `<div class="flex justify-between text-zinc-300">
                                <span>
                                    ${d.name}
                                    (Sum: ${d.sum})
                                </span>

                                <span class="font-mono text-amber-400">
                                    +${d.pointsAdded} pts
                                </span>
                            </div>`;
                    }
                );

                div.innerHTML =
                    `<div class="flex justify-between items-center font-bold text-emerald-300 border-b border-zinc-800 pb-1">
                        <span>
                            Round ${round.roundNumber}
                            (${round.callerName}'s Show)
                        </span>

                        <span class="text-[10px] text-zinc-400 font-normal">
                            ${round.outcome}
                        </span>
                    </div>

                    <div class="space-y-1 text-xs pt-1">
                        ${detailsHtml}
                    </div>`;

                container.appendChild(
                    div
                );
            }
        );
    }
