/**
 * Kalshi Tradebot2 - Dual Scrolling Alert Engine
 * Feed 1: All Events with price swings >= $0.10
 * Feed 2: Selective Filter for Quantitative High-ROI Model Signals
 */

class KalshiAlertEngine {
    constructor(allChatId, highRoiChatId, chartEngineRef) {
        this.allChatEl = document.getElementById(allChatId);
        this.highRoiChatEl = document.getElementById(highRoiChatId);
        this.chartEngine = chartEngineRef;
        this.soundEnabled = false;
        this.allPaused = false;
        this.roiPaused = false;
        this.audioCtx = null;

        this.initFeeds();
        this.startAlertGenerator();
    }

    initFeeds() {
        if (!this.allChatEl || !this.highRoiChatEl) return;

        // Populate initial alert history based on verified events
        KALSHI_CONTRACTS.forEach(c => {
            if (Math.abs(c.change24h) >= 0.10) {
                this.addAlertToAllFeed({
                    ticker: c.ticker,
                    title: c.title,
                    topic: c.topicName,
                    prevPrice: c.prevPrice,
                    newPrice: c.yesPrice,
                    delta: c.change24h,
                    timestamp: new Date(Date.now() - Math.floor(Math.random() * 3600000)),
                    catalyst: (c.catalysts && c.catalysts[0]) ? c.catalysts[0].headline : null,
                    sourceUrl: c.sourceUrl
                });
            }

            if (c.modelRoi >= 18.0 && c.status === "Active") {
                this.addAlertToRoiFeed({
                    ticker: c.ticker,
                    title: c.title,
                    topic: c.topicName,
                    price: c.yesPrice,
                    fairValue: c.modelFairValue,
                    roi: c.modelRoi,
                    signal: c.modelSignal,
                    timestamp: new Date(Date.now() - Math.floor(Math.random() * 3600000)),
                    sourceUrl: c.sourceUrl
                });
            }
        });
    }

    playBeep(isPositive) {
        if (!this.soundEnabled) return;
        try {
            if (!this.audioCtx) {
                this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            osc.connect(gain);
            gain.connect(this.audioCtx.destination);
            osc.type = "sine";
            osc.frequency.setValueAtTime(isPositive ? 880 : 440, this.audioCtx.currentTime);
            gain.gain.setValueAtTime(0.08, this.audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.0001, this.audioCtx.currentTime + 0.18);
            osc.start();
            osc.stop(this.audioCtx.currentTime + 0.18);
        } catch (e) {
            // Audio context blocked until user gesture
        }
    }

    addAlertToAllFeed(alert) {
        if (!this.allChatEl) return;
        const isUp = alert.delta >= 0;
        const deltaFormatted = `${isUp ? '+' : ''}$${Math.abs(alert.delta).toFixed(2)}`;
        const timeStr = alert.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        const item = document.createElement('div');
        item.className = `alert-msg ${isUp ? 'alert-up' : 'alert-down'}`;
        item.innerHTML = `
            <div class="alert-top">
                <span class="alert-time">${timeStr}</span>
                <span class="alert-ticker" title="Click to view chart" onclick="window.tradebotApp.selectContract('${alert.ticker}')">${alert.ticker}</span>
                <span class="alert-badge topic-badge">${alert.topic}</span>
                <span class="alert-delta ${isUp ? 'txt-green' : 'txt-red'}">${isUp ? '▲' : '▼'} ${deltaFormatted}</span>
            </div>
            <div class="alert-body">
                <strong>$${alert.prevPrice.toFixed(2)}</strong> ➔ <strong class="${isUp ? 'txt-green' : 'txt-red'}">$${alert.newPrice.toFixed(2)}</strong> (YES)
                <div class="alert-title">${alert.title}</div>
                ${alert.catalyst ? `<div class="alert-catalyst">⚡ <em>${alert.catalyst}</em></div>` : ''}
            </div>
            <div class="alert-footer">
                <a href="${alert.sourceUrl}" target="_blank" rel="noopener noreferrer" class="alert-src-link">🔗 Official Source</a>
                <button class="btn-xs" onclick="window.tradebotApp.selectContract('${alert.ticker}')">View Chart</button>
            </div>
        `;

        this.allChatEl.appendChild(item);

        if (!this.allPaused) {
            this.allChatEl.scrollTop = this.allChatEl.scrollHeight;
        }

        this.playBeep(isUp);
    }

    addAlertToRoiFeed(alert) {
        if (!this.highRoiChatEl) return;
        const timeStr = alert.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        const item = document.createElement('div');
        item.className = 'alert-msg alert-roi';
        item.innerHTML = `
            <div class="alert-top">
                <span class="alert-time">${timeStr}</span>
                <span class="alert-ticker" title="Click to view chart" onclick="window.tradebotApp.selectContract('${alert.ticker}')">${alert.ticker}</span>
                <span class="alert-badge roi-badge">ROI: +${alert.roi.toFixed(1)}%</span>
                <span class="alert-signal txt-green">${alert.signal}</span>
            </div>
            <div class="alert-body">
                <span>Contract Price: <strong>$${alert.price.toFixed(2)}</strong> | Model Fair Value: <strong class="txt-blue">$${alert.fairValue.toFixed(2)}</strong></span>
                <div class="alert-title">${alert.title}</div>
            </div>
            <div class="alert-footer">
                <a href="${alert.sourceUrl}" target="_blank" rel="noopener noreferrer" class="alert-src-link">🔗 Official Source</a>
                <button class="btn-xs btn-buy" onclick="window.tradebotApp.executeQuickSimTrade('${alert.ticker}', 'YES')">Quick Trade YES</button>
            </div>
        `;

        this.highRoiChatEl.appendChild(item);

        if (!this.roiPaused) {
            this.highRoiChatEl.scrollTop = this.highRoiChatEl.scrollHeight;
        }

        this.playBeep(true);
    }

    startAlertGenerator() {
        // Periodically inject realistic sudden >= $0.10 price swings into the scrolling feeds
        setInterval(() => {
            const activeContracts = KALSHI_CONTRACTS.filter(c => c.status === "Active");
            if (activeContracts.length === 0) return;

            const c = activeContracts[Math.floor(Math.random() * activeContracts.length)];
            const jumpMagnitude = (Math.random() > 0.5 ? 1 : -1) * (0.10 + Math.floor(Math.random() * 5) * 0.01);
            const prev = c.yesPrice;
            const updated = Math.max(0.01, Math.min(0.99, parseFloat((prev + jumpMagnitude).toFixed(2))));
            const actualDelta = parseFloat((updated - prev).toFixed(2));

            if (Math.abs(actualDelta) >= 0.10) {
                c.prevPrice = prev;
                c.yesPrice = updated;
                c.noPrice = parseFloat((1.0 - updated).toFixed(2));
                c.change24h = actualDelta;

                this.addAlertToAllFeed({
                    ticker: c.ticker,
                    title: c.title,
                    topic: c.topicName,
                    prevPrice: prev,
                    newPrice: updated,
                    delta: actualDelta,
                    timestamp: new Date(),
                    catalyst: (c.catalysts && c.catalysts[0]) ? c.catalysts[0].headline : "Sudden order book liquidity shift",
                    sourceUrl: c.sourceUrl
                });

                if (c.modelRoi >= 18.0) {
                    this.addAlertToRoiFeed({
                        ticker: c.ticker,
                        title: c.title,
                        topic: c.topicName,
                        price: updated,
                        fairValue: c.modelFairValue,
                        roi: c.modelRoi,
                        signal: c.modelSignal,
                        timestamp: new Date(),
                        sourceUrl: c.sourceUrl
                    });
                }
            }
        }, 8000);
    }
}
