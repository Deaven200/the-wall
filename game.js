// Game Configuration
const CONFIG = {
    TURRET_COST: 20,
    TURRET_FIRE_RATE: 0.5, // seconds
    TURRET_RANGE: 100,
    TURRET_DAMAGE: 10,
    WALL_SPEED: 20, // pixels per second
    WALL_HEALTH_MAX: 100,
    RESOURCE_GATHER_RATE: 2, // resources per second per patch
};

// Game State
let gameState = {
    resources: 0,
    turrets: [],
    resourcePatches: [],
    wall: null,
    gameTime: 0,
    isPaused: false,
};

// Canvas Setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth - 320;
canvas.height = window.innerHeight - 120;

// Resize canvas on window resize
window.addEventListener('resize', () => {
    canvas.width = window.innerWidth - 320;
    canvas.height = window.innerHeight - 120;
});

// Neon Colors
const COLORS = {
    cyan: '#00ffff',
    magenta: '#ff00ff',
    green: '#00ff00',
    pink: '#ff006e',
    blue: '#0080ff',
    yellow: '#ffff00',
    darkBg: '#0a0e27',
};

// Classes
class Wall {
    constructor(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.health = CONFIG.WALL_HEALTH_MAX;
        this.maxHealth = CONFIG.WALL_HEALTH_MAX;
    }

    update(deltaTime) {
        this.y += CONFIG.WALL_SPEED * deltaTime;
    }

    takeDamage(amount) {
        this.health = Math.max(0, this.health - amount);
    }

    draw(ctx) {
        // Draw main wall body with neon effect
        ctx.fillStyle = COLORS.magenta;
        ctx.fillRect(this.x, this.y, this.width, this.height);

        // Neon glow
        ctx.shadowColor = COLORS.magenta;
        ctx.shadowBlur = 20;
        ctx.strokeStyle = COLORS.cyan;
        ctx.lineWidth = 3;
        ctx.strokeRect(this.x, this.y, this.width, this.height);
        ctx.shadowBlur = 0;

        // Health bar
        const barWidth = this.width;
        const barHeight = 8;
        const barY = this.y - 15;
        
        ctx.fillStyle = 'rgba(255, 0, 255, 0.3)';
        ctx.fillRect(this.x, barY, barWidth, barHeight);
        
        ctx.fillStyle = COLORS.green;
        const healthPercent = this.health / this.maxHealth;
        ctx.fillRect(this.x, barY, barWidth * healthPercent, barHeight);
    }

    isDefeated() {
        return this.health <= 0;
    }

    hasReachedBottom(canvasHeight) {
        return this.y > canvasHeight;
    }
}

class Turret {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.range = CONFIG.TURRET_RANGE;
        this.damage = CONFIG.TURRET_DAMAGE;
        this.fireRate = CONFIG.TURRET_FIRE_RATE;
        this.lastShotTime = 0;
        this.rotation = 0;
    }

    update(deltaTime, wall) {
        const dx = wall.x + wall.width / 2 - this.x;
        const dy = wall.y + wall.height / 2 - this.y;
        this.rotation = Math.atan2(dy, dx);

        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < this.range) {
            this.lastShotTime += deltaTime;
            if (this.lastShotTime >= this.fireRate) {
                wall.takeDamage(this.damage);
                this.lastShotTime = 0;
                return true; // Fired
            }
        }
        return false;
    }

    draw(ctx) {
        // Base
        ctx.fillStyle = COLORS.cyan;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 15, 0, Math.PI * 2);
        ctx.fill();

        // Neon glow on base
        ctx.shadowColor = COLORS.cyan;
        ctx.shadowBlur = 15;
        ctx.strokeStyle = COLORS.blue;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 15, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Barrel
        const barrelLength = 20;
        const barrelX = this.x + Math.cos(this.rotation) * barrelLength;
        const barrelY = this.y + Math.sin(this.rotation) * barrelLength;
        
        ctx.strokeStyle = COLORS.green;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(barrelX, barrelY);
        ctx.stroke();

        // Range indicator (subtle)
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.range, 0, Math.PI * 2);
        ctx.stroke();
    }
}

class ResourcePatch {
    constructor(x, y, size, maxResources) {
        this.x = x;
        this.y = y;
        this.size = size;
        this.maxResources = maxResources;
        this.resources = maxResources;
        this.gatherRate = CONFIG.RESOURCE_GATHER_RATE;
        this.isActive = false;
    }

    gather(deltaTime) {
        const amount = Math.min(this.resources, this.gatherRate * deltaTime);
        this.resources -= amount;
        return amount;
    }

    draw(ctx) {
        // Outer ring
        ctx.strokeStyle = this.isActive ? COLORS.green : COLORS.yellow;
        ctx.lineWidth = 3;
        ctx.shadowColor = this.isActive ? COLORS.green : COLORS.yellow;
        ctx.shadowBlur = this.isActive ? 20 : 10;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Inner core
        ctx.fillStyle = this.isActive ? COLORS.green : COLORS.blue;
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size * 0.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;

        // Resource indicator
        const resourcePercent = this.resources / this.maxResources;
        ctx.fillStyle = COLORS.yellow;
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size * 0.3, 0, Math.PI * 2 * resourcePercent);
        ctx.fill();
        ctx.globalAlpha = 1;
    }

    isDepleted() {
        return this.resources <= 0;
    }
}

// Initialize Game
function initGame() {
    // Create the descending wall
    gameState.wall = new Wall(canvas.width / 2 - 100, -50, 200, 40);

    // Create resource patches scattered around the map
    const patchCount = 5;
    for (let i = 0; i < patchCount; i++) {
        const x = Math.random() * (canvas.width - 100) + 50;
        const y = Math.random() * (canvas.height - 200) + 100;
        const patch = new ResourcePatch(x, y, 20, 100);
        gameState.resourcePatches.push(patch);
    }

    // Event listeners
    document.getElementById('buildTurretBtn').addEventListener('click', () => {
        canvas.style.cursor = 'crosshair';
        alert('Click on the canvas to place a turret');
    });

    canvas.addEventListener('click', (e) => {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (gameState.resources >= CONFIG.TURRET_COST) {
            gameState.turrets.push(new Turret(x, y));
            gameState.resources -= CONFIG.TURRET_COST;
            updateUI();
        } else {
            alert('Not enough resources!');
        }
    });

    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Check if hovering over resource patch
        gameState.resourcePatches.forEach(patch => {
            const distance = Math.sqrt((patch.x - x) ** 2 + (patch.y - y) ** 2);
            patch.isActive = distance < patch.size + 20;
        });
    });

    // Start game loop
    let lastTime = Date.now();
    function gameLoop() {
        const now = Date.now();
        const deltaTime = (now - lastTime) / 1000;
        lastTime = now;

        update(deltaTime);
        draw();
        requestAnimationFrame(gameLoop);
    }
    gameLoop();
}

function update(deltaTime) {
    if (gameState.isPaused) return;

    // Update wall
    gameState.wall.update(deltaTime);

    // Update turrets and check for wall hits
    gameState.turrets.forEach(turret => {
        turret.update(deltaTime, gameState.wall);
    });

    // Gather resources from patches
    gameState.resourcePatches.forEach(patch => {
        if (patch.isActive && !patch.isDepleted()) {
            gameState.resources += patch.gather(deltaTime);
        }
    });

    // Remove depleted patches and defeated walls
    gameState.resourcePatches = gameState.resourcePatches.filter(p => !p.isDepleted());

    // Check win/lose conditions
    if (gameState.wall.isDefeated()) {
        console.log('Wall destroyed!');
        // TODO: Victory state
    }

    if (gameState.wall.hasReachedBottom(canvas.height)) {
        console.log('Game Over! Wall reached bottom');
        // TODO: Game over state
    }

    gameState.gameTime += deltaTime;
    updateUI();
}

function draw() {
    // Clear canvas
    ctx.fillStyle = COLORS.darkBg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid (optional visual aid)
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i < canvas.width; i += 50) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, canvas.height);
        ctx.stroke();
    }
    for (let i = 0; i < canvas.height; i += 50) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(canvas.width, i);
        ctx.stroke();
    }

    // Draw game objects
    gameState.resourcePatches.forEach(patch => patch.draw(ctx));
    gameState.turrets.forEach(turret => turret.draw(ctx));
    gameState.wall.draw(ctx);
}

function updateUI() {
    document.getElementById('resourceCount').textContent = Math.floor(gameState.resources);
    document.getElementById('wallHealth').textContent = Math.floor(gameState.wall.health);
    document.getElementById('turretCount').textContent = gameState.turrets.length;

    // Update turret build button
    const buildBtn = document.getElementById('buildTurretBtn');
    if (gameState.resources >= CONFIG.TURRET_COST) {
        buildBtn.disabled = false;
    } else {
        buildBtn.disabled = true;
    }

    // Update resource list
    const resourceList = document.getElementById('resourceList');
    resourceList.innerHTML = gameState.resourcePatches.map((patch, idx) => `
        <div class="resource-item">
            <div class="resource-name">Patch ${idx + 1}</div>
            <div class="resource-amount">${Math.floor(patch.resources)}/${patch.maxResources}</div>
        </div>
    `).join('');
}

// Start the game
initGame();