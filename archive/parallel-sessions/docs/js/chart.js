/**
 * Kalshi Tradebot2 - Interactive Canvas Chart & Order Book Depth Engine
 * Supports multi-resolution timeframes (Seconds, Minutes, Hours),
 * sudden jump pins (>= $0.10), catalyst event links, and order book liquidity ladders.
 */

class KalshiChartEngine {
    constructor(canvasId, orderBookContainerId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
        this.orderBookContainer = document.getElementById(orderBookContainerId);
        this.currentTicker = "BTC-25Q1-110K";
        this.timeframe = "minutes"; // 'seconds', 'minutes', 'hours'
        this.historyData = {};
        this.hoverPoint = null;
        this.isLive = true;
        this.tickInterval = null;

        if (this.canvas) {
            this.initData();
            this.setupEvents();
            this.render();
            this.startLiveSimulation();
        }
    }

    initData() {
        // Generate realistic historical paths for each contract with a distinct >= $0.10 jump
        KALSHI_CONTRACTS.forEach(contract => {
            this.historyData[contract.ticker] = {
                seconds: this.generatePath(contract, 60, 1),
                minutes: this.generatePath(contract, 60, 60),
                hours: this.generatePath(contract, 48, 3600)
            };
        });
    }

    generatePath(contract, count, intervalSec) {
        const points = [];
        const now = Date.now();
        const basePrice = contract.yesPrice;
        let p = Math.max(0.05, Math.min(0.95, contract.prevPrice || (basePrice - contract.change24h)));

        // Pick an index where a >= $0.10 jump occurred
        const jumpIndex = Math.floor(count * 0.65);

        for (let i = count - 1; i >= 0; i--) {
            const time = new Date(now - i * intervalSec * 1000);
            let catalyst = null;

            if (i === count - 1 - jumpIndex) {
                // Trigger the >= $0.10 jump
                p = Math.max(0.02, Math.min(0.98, p + contract.change24h));
                if (contract.catalysts && contract.catalysts.length > 0) {
                    catalyst = contract.catalysts[0];
                }
            } else if (i < count - 1 - jumpIndex) {
                // Minor random walk towards current price
                const step = (Math.random() - 0.48) * 0.015;
                p = Math.max(0.01, Math.min(0.99, p + step));
            } else {
                // Before jump
                const step = (Math.random() - 0.5) * 0.01;
                p = Math.max(0.01, Math.min(0.99, p + step));
            }

            // Ensure last point is exactly current price
            if (i === 0) {
                p = contract.yesPrice;
            }

            points.push({
                timestamp: time,
                price: parseFloat(p.toFixed(2)),
                volume: Math.floor(Math.random() * 8000) + 1200,
                catalyst: catalyst
            });
        }
        return points;
    }

    setupEvents() {
        // Resize canvas to match display size cleanly
        window.addEventListener('resize', () => this.render());

        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            this.handleMouseMove(x, y);
        });

        this.canvas.addEventListener('mouseleave', () => {
            this.hoverPoint = null;
            this.render();
        });

        this.canvas.addEventListener('click', () => {
            if (this.hoverPoint && this.hoverPoint.catalyst) {
                this.showCatalystModal(this.hoverPoint.catalyst);
            }
        });
    }

    setTimeframe(tf) {
        this.timeframe = tf;
        this.render();
    }

    setContract(ticker) {
        this.currentTicker = ticker;
        this.render();
        this.renderOrderBook();
    }

    render() {
        if (!this.ctx) return;

        // Retina / High-DPI scaling
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.ctx.scale(dpr, dpr);

        const width = rect.width;
        const height = rect.height;
        const ctx = this.ctx;

        // Clear Background
        ctx.fillStyle = "#0c1017";
        ctx.fillRect(0, 0, width, height);

        const contract = getContractByTicker(this.currentTicker);
        if (!contract) return;

        const data = (this.historyData[this.currentTicker] && this.historyData[this.currentTicker][this.timeframe]) || [];
        if (data.length < 2) return;

        const padding = { top: 35, right: 65, bottom: 40, left: 20 };
        const plotWidth = width - padding.left - padding.right;
        const plotHeight = height - padding.top - padding.bottom;

        // Fixed Y-axis $0.00 to $1.00 for Kalshi binary contract standard
        const yMin = 0.00;
        const yMax = 1.00;

        // Draw horizontal grid lines ($0.10 step)
        ctx.lineWidth = 1;
        ctx.strokeStyle = "rgba(255, 255, 255, 0.07)";
        ctx.fillStyle = "#8b949e";
        ctx.font = "11px Inter, -apple-system, sans-serif";
        ctx.textAlign = "left";

        for (let v = 0.0; v <= 1.01; v += 0.10) {
            const y = padding.top + plotHeight - (v / yMax) * plotHeight;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(width - padding.right, y);
            ctx.stroke();

            // Y-axis label on right side
            ctx.fillText(`$${v.toFixed(2)}`, width - padding.right + 8, y + 4);
        }

        // Draw Time Axis Grid (X-axis)
        const xStep = plotWidth / (data.length - 1);
        ctx.textAlign = "center";
        const labelInterval = Math.max(1, Math.floor(data.length / 6));

        for (let i = 0; i < data.length; i += labelInterval) {
            const x = padding.left + i * xStep;
            ctx.beginPath();
            ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
            ctx.moveTo(x, padding.top);
            ctx.lineTo(x, padding.top + plotHeight);
            ctx.stroke();

            const d = data[i].timestamp;
            let timeStr = "";
            if (this.timeframe === "seconds") {
                timeStr = d.toTimeString().split(' ')[0];
            } else if (this.timeframe === "minutes") {
                timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            } else {
                timeStr = `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:00`;
            }
            ctx.fillText(timeStr, x, height - padding.bottom + 20);
        }

        // Draw Area Gradient & Price Line
        ctx.beginPath();
        const startX = padding.left;
        const startY = padding.top + plotHeight - (data[0].price / yMax) * plotHeight;
        ctx.moveTo(startX, startY);

        for (let i = 1; i < data.length; i++) {
            const x = padding.left + i * xStep;
            const y = padding.top + plotHeight - (data[i].price / yMax) * plotHeight;
            ctx.lineTo(x, y);
        }

        // Color based on 24h change
        const isUp = contract.change24h >= 0;
        const lineColor = isUp ? "#238636" : "#da3633";
        const gradientColor = isUp ? "rgba(35, 134, 54, 0.25)" : "rgba(218, 54, 51, 0.25)";

        // Fill under line
        ctx.save();
        ctx.lineTo(padding.left + (data.length - 1) * xStep, padding.top + plotHeight);
        ctx.lineTo(padding.left, padding.top + plotHeight);
        ctx.closePath();
        const grad = ctx.createLinearGradient(0, padding.top, 0, padding.top + plotHeight);
        grad.addColorStop(0, gradientColor);
        grad.addColorStop(1, "rgba(12, 16, 23, 0.0)");
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.restore();

        // Stroke line
        ctx.strokeStyle = lineColor;
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Draw Jump Markers (>= $0.10) and Catalysts
        data.forEach((pt, idx) => {
            if (pt.catalyst || Math.abs(contract.change24h) >= 0.10 && idx === Math.floor(data.length * 0.65)) {
                const x = padding.left + idx * xStep;
                const y = padding.top + plotHeight - (pt.price / yMax) * plotHeight;

                // Glowing pulsing pin
                ctx.beginPath();
                ctx.arc(x, y, 7, 0, Math.PI * 2);
                ctx.fillStyle = isUp ? "#2ea043" : "#f85149";
                ctx.fill();
                ctx.strokeStyle = "#ffffff";
                ctx.lineWidth = 2;
                ctx.stroke();

                // Callout banner
                ctx.fillStyle = "rgba(22, 27, 34, 0.92)";
                ctx.strokeStyle = isUp ? "#3fb950" : "#f85149";
                ctx.lineWidth = 1;
                const badgeText = `${isUp ? '+' : ''}$${Math.abs(contract.change24h).toFixed(2)} JUMP`;
                const textWidth = ctx.measureText(badgeText).width;
                const badgeX = Math.min(width - padding.right - textWidth - 12, Math.max(padding.left + 5, x - textWidth / 2 - 6));
                const badgeY = y - 28 > padding.top ? y - 28 : y + 16;

                ctx.fillRect(badgeX, badgeY, textWidth + 12, 20);
                ctx.strokeRect(badgeX, badgeY, textWidth + 12, 20);

                ctx.fillStyle = isUp ? "#3fb950" : "#f85149";
                ctx.font = "bold 10px Inter, sans-serif";
                ctx.textAlign = "left";
                ctx.fillText(badgeText, badgeX + 6, badgeY + 14);
            }
        });

        // Hover crosshair and tooltip
        if (this.hoverPoint) {
            const hp = this.hoverPoint;
            // Vertical line
            ctx.beginPath();
            ctx.setLineDash([4, 4]);
            ctx.strokeStyle = "#58a6ff";
            ctx.lineWidth = 1;
            ctx.moveTo(hp.x, padding.top);
            ctx.lineTo(hp.x, padding.top + plotHeight);
            ctx.stroke();
            ctx.setLineDash([]);

            // Dot on line
            ctx.beginPath();
            ctx.arc(hp.x, hp.y, 5, 0, Math.PI * 2);
            ctx.fillStyle = "#58a6ff";
            ctx.fill();
            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 2;
            ctx.stroke();

            // Tooltip box
            this.drawTooltip(ctx, hp, width, height);
        }

        // Header overlay on chart
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 14px Inter, sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(`${contract.ticker}: $${contract.yesPrice.toFixed(2)}`, padding.left, 22);

        ctx.fillStyle = isUp ? "#3fb950" : "#f85149";
        ctx.font = "12px Inter, sans-serif";
        const deltaStr = `${isUp ? '+' : ''}$${contract.change24h.toFixed(2)} (${(contract.change24h * 100).toFixed(1)}%) 24h`;
        ctx.fillText(deltaStr, padding.left + 170, 22);
    }

    drawTooltip(ctx, hp, width, height) {
        const pt = hp.dataPoint;
        const lines = [
            `Time: ${pt.timestamp.toLocaleTimeString()}`,
            `Contract Price: $${pt.price.toFixed(2)} (YES)`,
            `Implied Odds: ${(pt.price * 100).toFixed(0)}%`,
            `Volume: ${pt.volume.toLocaleString()} contracts`
        ];
        if (pt.catalyst) {
            lines.push(`🚨 Jump Catalyst: ${pt.catalyst.source} (Click for link)`);
        }

        ctx.font = "11px Inter, sans-serif";
        let maxW = 180;
        lines.forEach(l => {
            const w = ctx.measureText(l).width;
            if (w > maxW) maxW = w;
        });

        const boxW = maxW + 20;
        const boxH = lines.length * 18 + 12;
        let boxX = hp.x + 12;
        if (boxX + boxW > width - 20) boxX = hp.x - boxW - 12;
        let boxY = hp.y - boxH / 2;
        if (boxY < 10) boxY = 10;
        if (boxY + boxH > height - 10) boxY = height - boxH - 10;

        ctx.fillStyle = "rgba(13, 17, 23, 0.95)";
        ctx.strokeStyle = pt.catalyst ? "#f85149" : "#30363d";
        ctx.lineWidth = 1.5;
        ctx.fillRect(boxX, boxY, boxW, boxH);
        ctx.strokeRect(boxX, boxY, boxW, boxH);

        lines.forEach((l, i) => {
            ctx.fillStyle = i === 4 ? "#f85149" : (i === 1 ? "#58a6ff" : "#c9d1d9");
            ctx.fillText(l, boxX + 10, boxY + 16 + i * 18);
        });
    }

    handleMouseMove(x, y) {
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;

        const padding = { top: 35, right: 65, bottom: 40, left: 20 };
        const plotWidth = width - padding.left - padding.right;
        const plotHeight = height - padding.top - padding.bottom;

        if (x < padding.left || x > width - padding.right || y < padding.top || y > height - padding.bottom) {
            this.hoverPoint = null;
            this.render();
            return;
        }

        const data = (this.historyData[this.currentTicker] && this.historyData[this.currentTicker][this.timeframe]) || [];
        if (data.length < 2) return;

        const xStep = plotWidth / (data.length - 1);
        const idx = Math.min(data.length - 1, Math.max(0, Math.round((x - padding.left) / xStep)));
        const point = data[idx];
        const pointX = padding.left + idx * xStep;
        const pointY = padding.top + plotHeight - (point.price / 1.00) * plotHeight;

        this.hoverPoint = {
            x: pointX,
            y: pointY,
            dataPoint: point,
            catalyst: point.catalyst
        };

        this.render();
    }

    renderOrderBook() {
        if (!this.orderBookContainer) return;
        const contract = getContractByTicker(this.currentTicker);
        if (!contract || !contract.orderBook) return;

        const maxQty = Math.max(
            ...contract.orderBook.bids.map(b => b.quantity),
            ...contract.orderBook.asks.map(a => a.quantity)
        );

        let html = `
            <div class="orderbook-header">
                <div class="ob-title">📊 Real-Time Liquidity Depth Ladder</div>
                <div class="ob-ticker">${contract.ticker} | Spread: $${(contract.orderBook.asks[0].price - contract.orderBook.bids[0].price).toFixed(2)}</div>
            </div>
            <div class="orderbook-table-container">
                <div class="ob-side ob-bids">
                    <div class="ob-col-title">🟢 Bids (Buyers)</div>
                    <div class="ob-rows">
        `;

        contract.orderBook.bids.forEach(bid => {
            const barW = Math.round((bid.quantity / maxQty) * 100);
            html += `
                <div class="ob-row bid-row">
                    <div class="ob-bar bid-bar" style="width: ${barW}%;"></div>
                    <span class="ob-qty">${bid.quantity.toLocaleString()}</span>
                    <span class="ob-price">$${bid.price.toFixed(2)}</span>
                </div>
            `;
        });

        html += `
                    </div>
                </div>
                <div class="ob-side ob-asks">
                    <div class="ob-col-title">🔴 Asks (Sellers)</div>
                    <div class="ob-rows">
        `;

        contract.orderBook.asks.forEach(ask => {
            const barW = Math.round((ask.quantity / maxQty) * 100);
            html += `
                <div class="ob-row ask-row">
                    <div class="ob-bar ask-bar" style="width: ${barW}%;"></div>
                    <span class="ob-price">$${ask.price.toFixed(2)}</span>
                    <span class="ob-qty">${ask.quantity.toLocaleString()}</span>
                </div>
            `;
        });

        html += `
                    </div>
                </div>
            </div>
            <div class="ob-footer">
                <span class="ob-stat">Total Bids Liquidity: <strong>${contract.orderBook.bids.reduce((a,b)=>a+b.quantity, 0).toLocaleString()}</strong> contracts</span>
                <span class="ob-stat">Total Asks Liquidity: <strong>${contract.orderBook.asks.reduce((a,b)=>a+b.quantity, 0).toLocaleString()}</strong> contracts</span>
            </div>
        `;

        this.orderBookContainer.innerHTML = html;
    }

    startLiveSimulation() {
        if (this.tickInterval) clearInterval(this.tickInterval);
        this.tickInterval = setInterval(() => {
            if (!this.isLive) return;

            // Generate subtle live tick updates
            KALSHI_CONTRACTS.forEach(c => {
                if (c.status === "Active") {
                    const delta = (Math.random() - 0.49) * 0.01;
                    const newP = Math.max(0.01, Math.min(0.99, parseFloat((c.yesPrice + delta).toFixed(2))));
                    c.yesPrice = newP;
                    c.noPrice = parseFloat((1.0 - newP).toFixed(2));

                    // Append to seconds array
                    if (this.historyData[c.ticker] && this.historyData[c.ticker].seconds) {
                        const arr = this.historyData[c.ticker].seconds;
                        arr.shift();
                        arr.push({
                            timestamp: new Date(),
                            price: newP,
                            volume: Math.floor(Math.random() * 500) + 100,
                            catalyst: null
                        });
                    }
                }
            });

            this.render();
            this.renderOrderBook();
        }, 1500);
    }

    showCatalystModal(catalyst) {
        alert(`🚨 Kalshi Jump Catalyst Detail:
----------------------------------------
Event: ${catalyst.headline}
Price Move: ${catalyst.priceChange >= 0 ? '+' : ''}$${catalyst.priceChange.toFixed(2)}
Source: ${catalyst.source}
Official Verified Link: ${catalyst.url}
Timestamp: ${new Date(catalyst.time).toLocaleString()}`);
    }
}
