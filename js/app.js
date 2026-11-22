/**
 * Kalshi Tradebot2 - Main Application Orchestrator
 * Integrates Chart Engine, Dual Alerts, Simulated Trading, and Data Tables.
 */

class TradebotApp {
    constructor() {
        this.chart = null;
        this.alerts = null;
        this.trading = null;
        this.init();
    }

    init() {
        // Initialize Trading Engine
        this.trading = new KalshiTradingEngine();

        // Initialize Chart Engine if canvas exists
        if (document.getElementById('liveChartCanvas')) {
            this.chart = new KalshiChartEngine('liveChartCanvas', 'orderBookContainer');
        }

        // Initialize Alerts Engine if feeds exist
        if (document.getElementById('allAlertsFeed') && document.getElementById('highRoiAlertsFeed')) {
            this.alerts = new KalshiAlertEngine('allAlertsFeed', 'highRoiAlertsFeed', this.chart);
        }

        // Populate UI
        this.populateContractSelect();
        this.populateContractsTable();
        this.updatePortfolioUI();
        this.setupEventListeners();
    }

    populateContractSelect() {
        const select = document.getElementById('contractSelect');
        if (!select) return;

        select.innerHTML = '';
        KALSHI_TOPICS.forEach(topic => {
            const optgroup = document.createElement('optgroup');
            optgroup.label = `${topic.icon} ${topic.name}`;
            const contracts = getContractsByTopic(topic.id);
            contracts.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.ticker;
                opt.textContent = `${c.ticker} - $${c.yesPrice.toFixed(2)} (${c.title.substring(0, 32)}...)`;
                if (c.ticker === "BTC-25Q1-110K") opt.selected = true;
                optgroup.appendChild(opt);
            });
            select.appendChild(optgroup);
        });

        select.addEventListener('change', (e) => {
            this.selectContract(e.target.value);
        });
    }

    selectContract(ticker) {
        if (this.chart) {
            this.chart.setContract(ticker);
        }
        const select = document.getElementById('contractSelect');
        if (select) select.value = ticker;

        // Update Quick Trade form if present
        const tradeTicker = document.getElementById('tradeTicker');
        if (tradeTicker) tradeTicker.value = ticker;
    }

    setTimeframe(tf) {
        if (this.chart) {
            this.chart.setTimeframe(tf);
            document.querySelectorAll('.tf-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.tf === tf);
            });
        }
    }

    populateContractsTable() {
        const tableBody = document.getElementById('eventsTableBody');
        if (!tableBody) return;

        tableBody.innerHTML = '';
        KALSHI_CONTRACTS.forEach(c => {
            const row = document.createElement('tr');
            const isUp = c.change24h >= 0;
            const deltaFormatted = `${isUp ? '+' : ''}$${Math.abs(c.change24h).toFixed(2)}`;

            let statusBadge = '';
            if (c.status === "Active") {
                statusBadge = `<span class="status-badge status-active">Active</span>`;
            } else if (c.status === "Resolved YES") {
                statusBadge = `<span class="status-badge status-resolved-yes">Resolved YES</span>`;
            } else {
                statusBadge = `<span class="status-badge status-resolved-no">Resolved NO</span>`;
            }

            const bestBid = c.orderBook && c.orderBook.bids[0] ? `$${c.orderBook.bids[0].price.toFixed(2)}` : "-";
            const bestAsk = c.orderBook && c.orderBook.asks[0] ? `$${c.orderBook.asks[0].price.toFixed(2)}` : "-";
            const totalLiquidity = c.orderBook ? 
                (c.orderBook.bids.reduce((a,b)=>a+b.quantity,0) + c.orderBook.asks.reduce((a,b)=>a+b.quantity,0)).toLocaleString() : "-";

            row.innerHTML = `
                <td><strong class="txt-blue" style="cursor:pointer;" onclick="window.tradebotApp.selectContract('${c.ticker}')">${c.ticker}</strong></td>
                <td><span class="topic-badge">${c.topicName}</span></td>
                <td style="max-width:280px; white-space:normal; font-size:12px;">${c.title}</td>
                <td style="font-family:var(--font-mono);"><strong>$${c.yesPrice.toFixed(2)}</strong></td>
                <td style="font-family:var(--font-mono);">$${c.noPrice.toFixed(2)}</td>
                <td class="${isUp ? 'txt-green' : 'txt-red'}" style="font-family:var(--font-mono);">${deltaFormatted}</td>
                <td>${totalLiquidity} <small class="text-muted">(${bestBid} / ${bestAsk})</small></td>
                <td>$${c.dollarVolume.toLocaleString()}</td>
                <td>${statusBadge}</td>
                <td style="font-size:11px;">${c.resolutionDate}</td>
                <td>
                    <a href="${c.sourceUrl}" target="_blank" rel="noopener noreferrer" class="source-link-cell" title="Verify from official source">
                        🔗 ${c.sourceName}
                    </a>
                </td>
            `;
            tableBody.appendChild(row);
        });
    }

    updatePortfolioUI() {
        if (!this.trading) return;
        const summary = this.trading.getPortfolioSummary();

        const cashEl = document.getElementById('portCash');
        if (cashEl) cashEl.textContent = `$${summary.cash.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;

        const equityEl = document.getElementById('portEquity');
        if (equityEl) equityEl.textContent = `$${summary.totalEquity.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;

        const pnlEl = document.getElementById('portTotalPnl');
        if (pnlEl) {
            const isProfit = summary.totalPnl >= 0;
            pnlEl.textContent = `${isProfit ? '+' : ''}$${summary.totalPnl.toFixed(2)} (${isProfit ? '+' : ''}${summary.totalReturnPct.toFixed(2)}%)`;
            pnlEl.className = isProfit ? "metric-val txt-green" : "metric-val txt-red";
        }

        const winRateEl = document.getElementById('portWinRate');
        if (winRateEl) winRateEl.textContent = `${summary.winRate}% (${summary.winningTrades}/${summary.totalTrades})`;

        const sharpeEl = document.getElementById('portSharpe');
        if (sharpeEl) sharpeEl.textContent = summary.sharpeRatio.toFixed(2);

        this.renderPositionsTable();
        this.renderTradesTable();
    }

    renderPositionsTable() {
        const body = document.getElementById('positionsTableBody');
        if (!body) return;

        body.innerHTML = '';
        if (this.trading.positions.length === 0) {
            body.innerHTML = '<tr><td colspan="8" style="text-align:center; color:var(--text-muted); padding:20px;">No open positions in Demo Account</td></tr>';
            return;
        }

        this.trading.positions.forEach(p => {
            const row = document.createElement('tr');
            const marketVal = p.qty * p.currentPrice;
            const costVal = p.qty * p.entryPrice;
            const unrealized = marketVal - costVal;
            const isProf = unrealized >= 0;

            row.innerHTML = `
                <td><strong class="txt-blue">${p.ticker}</strong></td>
                <td><span class="topic-badge">${p.topic}</span></td>
                <td><span class="status-badge ${p.direction.includes('YES') ? 'status-resolved-yes' : 'status-resolved-no'}">${p.direction}</span></td>
                <td>${p.qty}</td>
                <td>$${p.entryPrice.toFixed(2)}</td>
                <td>$${p.currentPrice.toFixed(2)}</td>
                <td class="${isProf ? 'txt-green' : 'txt-red'}">${isProf ? '+' : ''}$${unrealized.toFixed(2)} (${isProf ? '+' : ''}${((unrealized/costVal)*100).toFixed(1)}%)</td>
                <td><button class="btn-xs" onclick="window.tradebotApp.closeDemoPosition('${p.id}')">Close</button></td>
            `;
            body.appendChild(row);
        });
    }

    renderTradesTable() {
        const body = document.getElementById('tradesTableBody');
        if (!body) return;

        body.innerHTML = '';
        this.trading.tradeHistory.slice(0, 10).forEach(t => {
            const row = document.createElement('tr');
            const isProf = t.pnl >= 0;

            row.innerHTML = `
                <td style="font-size:11px; color:var(--text-muted);">${new Date(t.exitTime).toLocaleTimeString([], {month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit'})}</td>
                <td><strong class="txt-blue">${t.ticker}</strong></td>
                <td><span class="topic-badge">${t.topic}</span></td>
                <td>${t.direction}</td>
                <td>${t.qty}</td>
                <td>$${t.entryPrice.toFixed(2)} ➔ $${t.exitPrice.toFixed(2)}</td>
                <td class="${isProf ? 'txt-green' : 'txt-red'}">${isProf ? '+' : ''}$${t.pnl.toFixed(2)} (${isProf ? '+' : ''}${t.pnlPercent.toFixed(1)}%)</td>
                <td><span class="status-badge ${isProf ? 'status-resolved-yes' : 'status-resolved-no'}">${t.status}</span></td>
            `;
            body.appendChild(row);
        });
    }

    closeDemoPosition(posId) {
        const pos = this.trading.positions.find(p => p.id === posId);
        if (!pos) return;
        const contract = getContractByTicker(pos.ticker);
        const exitP = contract ? contract.yesPrice : pos.currentPrice;
        this.trading.closePosition(posId, exitP, "Manual User Exit");
        this.updatePortfolioUI();
    }

    executeQuickSimTrade(ticker, direction) {
        const res = this.trading.executeManualTrade(ticker, direction, 100);
        alert(res.message);
        this.updatePortfolioUI();
    }

    setupEventListeners() {
        // Sound toggle button
        const soundBtn = document.getElementById('soundToggleBtn');
        if (soundBtn && this.alerts) {
            soundBtn.addEventListener('click', () => {
                this.alerts.soundEnabled = !this.alerts.soundEnabled;
                soundBtn.textContent = this.alerts.soundEnabled ? "🔊 Sound: ON" : "🔇 Sound: OFF";
                soundBtn.classList.toggle('btn-primary', this.alerts.soundEnabled);
            });
        }

        // Pause / Resume feeds
        const pauseAllBtn = document.getElementById('pauseAllFeedBtn');
        if (pauseAllBtn && this.alerts) {
            pauseAllBtn.addEventListener('click', () => {
                this.alerts.allPaused = !this.alerts.allPaused;
                pauseAllBtn.textContent = this.alerts.allPaused ? "▶ Resume" : "⏸ Pause";
            });
        }

        const pauseRoiBtn = document.getElementById('pauseRoiFeedBtn');
        if (pauseRoiBtn && this.alerts) {
            pauseRoiBtn.addEventListener('click', () => {
                this.alerts.roiPaused = !this.alerts.roiPaused;
                pauseRoiBtn.textContent = this.alerts.roiPaused ? "▶ Resume" : "⏸ Pause";
            });
        }

        // Manual trade execution form
        const execBtn = document.getElementById('executeTradeBtn');
        if (execBtn) {
            execBtn.addEventListener('click', () => {
                const ticker = document.getElementById('tradeTicker').value;
                const dir = document.getElementById('tradeDirection').value;
                const qty = parseInt(document.getElementById('tradeQty').value) || 100;
                const res = this.trading.executeManualTrade(ticker, dir, qty);
                alert(res.message);
                this.updatePortfolioUI();
            });
        }
    }
}

// Global bootstrap
document.addEventListener('DOMContentLoaded', () => {
    window.tradebotApp = new TradebotApp();
});
