// Global state
let config = null;
let tasks = [];
let draggedTask = null;
let touchTimeout = null;
let nextTaskId = 1;

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    await loadConfig();
    initializeApp();
});

// Load configuration
async function loadConfig() {
    try {
        const response = await fetch('config.json');
        config = await response.json();
        console.log('Configuration loaded:', config);
    } catch (error) {
        console.error('Error loading configuration:', error);
        alert('Ошибка загрузки конфигурации!');
    }
}

// Initialize application
function initializeApp() {
    if (!config) return;

    // Set header
    document.getElementById('main-title').textContent = config.title;
    document.getElementById('subtitle').textContent = config.subtitle;

    // Initialize tasks
    initializeTasks();

    // Create Kanban board
    createKanbanBoard();

    // Setup modal
    setupModal();
}

// Initialize tasks from config
function initializeTasks() {
    config.initialTasks.forEach(taskConfig => {
        const team = getTeamById(taskConfig.teamId);
        const column = getColumnById(taskConfig.columnId);

        tasks.push({
            id: taskConfig.id,
            columnId: taskConfig.columnId,
            teamId: taskConfig.teamId,
            description: getGreetingForTask(taskConfig.columnId, taskConfig.teamId)
        });

        if (taskConfig.id >= nextTaskId) {
            nextTaskId = taskConfig.id + 1;
        }
    });
}

// Get team by ID
function getTeamById(teamId) {
    return config.teams.find(t => t.id === teamId);
}

// Get column by ID
function getColumnById(columnId) {
    return config.columns.find(c => c.id === columnId);
}

// Get random team
function getRandomTeam() {
    return config.teams[Math.floor(Math.random() * config.teams.length)];
}

// Get greeting for task
function getGreetingForTask(columnId, teamId) {
    const greetings = config.greetings[columnId];

    if (!greetings) {
        return 'Поздравление загружается...';
    }

    // If greetings is an array (for columns like backlog, bugs)
    if (Array.isArray(greetings)) {
        return greetings[Math.floor(Math.random() * greetings.length)];
    }

    // If greetings is an object with team-specific greetings
    if (typeof greetings === 'object') {
        const teamGreetings = greetings[teamId];
        if (teamGreetings && Array.isArray(teamGreetings)) {
            return teamGreetings[Math.floor(Math.random() * teamGreetings.length)];
        }
    }

    return 'Поздравление загружается...';
}

// Create Kanban board
function createKanbanBoard() {
    const board = document.getElementById('kanban-board');
    board.innerHTML = '';

    config.columns.forEach(column => {
        const columnElement = createColumnElement(column);
        board.appendChild(columnElement);
    });

    // Render tasks
    renderTasks();
}

// Create column element
function createColumnElement(column) {
    const columnDiv = document.createElement('div');
    columnDiv.className = 'kanban-column';
    columnDiv.dataset.column = column.id;

    columnDiv.innerHTML = `
        <div class="column-header">
            <div class="column-title">${column.title}</div>
            <div class="column-description">${column.description}</div>
        </div>
        <div class="column-tasks" data-column-id="${column.id}"></div>
    `;

    const tasksContainer = columnDiv.querySelector('.column-tasks');

    // Setup drag and drop
    tasksContainer.addEventListener('dragover', handleDragOver);
    tasksContainer.addEventListener('drop', handleDrop);
    tasksContainer.addEventListener('dragleave', handleDragLeave);

    return columnDiv;
}

// Render all tasks
function renderTasks() {
    // Clear all columns
    document.querySelectorAll('.column-tasks').forEach(container => {
        container.innerHTML = '';
    });

    // Render each task
    tasks.forEach(task => {
        const taskElement = createTaskElement(task);
        const container = document.querySelector(`.column-tasks[data-column-id="${task.columnId}"]`);
        if (container) {
            container.appendChild(taskElement);
        }
    });
}

// Create task element
function createTaskElement(task) {
    const team = getTeamById(task.teamId);
    const taskDiv = document.createElement('div');
    taskDiv.className = 'task-card';
    taskDiv.draggable = true;
    taskDiv.dataset.taskId = task.id;

    taskDiv.innerHTML = `
        <div class="task-header">
            <span class="task-id">TASK-${task.id}</span>
            <div class="team-badge" style="background: ${team.color}20;">
                <img src="${team.photo}" alt="${team.name}" class="team-photo" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2224%22 height=%2224%22%3E%3Crect width=%2224%22 height=%2224%22 fill=%22%23ccc%22/%3E%3C/svg%3E'">
                <span class="team-name">${team.name}</span>
            </div>
        </div>
        <div class="task-description">${task.description}</div>
    `;

    // Drag events for desktop
    taskDiv.addEventListener('dragstart', handleDragStart);
    taskDiv.addEventListener('dragend', handleDragEnd);

    // Touch events for mobile
    taskDiv.addEventListener('touchstart', handleTouchStart);
    taskDiv.addEventListener('touchmove', handleTouchMove);
    taskDiv.addEventListener('touchend', handleTouchEnd);

    // Click to open modal
    taskDiv.querySelector('.team-badge').addEventListener('click', (e) => {
        e.stopPropagation();
        showTaskModal(task);
    });

    return taskDiv;
}

// Drag and Drop handlers
function handleDragStart(e) {
    const taskId = parseInt(e.target.dataset.taskId);
    draggedTask = tasks.find(t => t.id === taskId);
    e.target.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
}

function handleDragEnd(e) {
    e.target.classList.remove('dragging');
    draggedTask = null;

    // Remove drag-over class from all columns
    document.querySelectorAll('.column-tasks').forEach(col => {
        col.classList.remove('drag-over');
    });
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    e.currentTarget.classList.add('drag-over');
}

function handleDragLeave(e) {
    if (e.target && e.target.classList && e.target.classList.contains('column-tasks')) {
        e.target.classList.remove('drag-over');
    }
}

function handleDrop(e) {
    e.preventDefault();

    if (e.currentTarget && e.currentTarget.classList) {
        e.currentTarget.classList.remove('drag-over');
    }

    if (!draggedTask) return;

    const newColumnId = e.currentTarget.dataset.columnId;
    const oldColumnId = draggedTask.columnId;

    moveTask(draggedTask.id, newColumnId, oldColumnId);
}

// Touch handlers for mobile
let touchStartX, touchStartY;
let isDragging = false;
let draggedElement = null;

// Detect iOS
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
              (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

function handleTouchStart(e) {
    const taskId = parseInt(e.currentTarget.dataset.taskId);
    const task = tasks.find(t => t.id === taskId);
    const element = e.currentTarget; // Save reference before setTimeout

    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;

    // Long press detection
    touchTimeout = setTimeout(() => {
        if (!element) return; // Safety check

        isDragging = true;
        draggedTask = task;
        draggedElement = element;
        element.classList.add('dragging');
        element.style.position = 'fixed';
        element.style.zIndex = '1000';
        element.style.pointerEvents = 'none';

        // Provide haptic feedback if available
        if ('vibrate' in navigator) {
            navigator.vibrate(50);
        }
    }, 500); // 500ms long press
}

function handleTouchMove(e) {
    if (touchTimeout) {
        // If moved before long press, cancel
        const moveX = Math.abs(e.touches[0].clientX - touchStartX);
        const moveY = Math.abs(e.touches[0].clientY - touchStartY);

        if (moveX > 10 || moveY > 10) {
            clearTimeout(touchTimeout);
            touchTimeout = null;
        }
    }

    if (isDragging && draggedElement) {
        e.preventDefault();
        const touch = e.touches[0];

        // iOS fix: temporarily hide element for reliable elementFromPoint
        let elementBelow;
        if (isIOS) {
            draggedElement.style.display = 'none';
            elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
            draggedElement.style.display = '';
        } else {
            elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
        }

        draggedElement.style.left = touch.clientX - draggedElement.offsetWidth / 2 + 'px';
        draggedElement.style.top = touch.clientY - draggedElement.offsetHeight / 2 + 'px';

        // Highlight column under touch
        document.querySelectorAll('.column-tasks').forEach(col => {
            col.classList.remove('drag-over');
        });

        if (elementBelow) {
            const columnTasks = elementBelow.closest('.column-tasks');
            if (columnTasks) {
                columnTasks.classList.add('drag-over');
            }
        }
    }
}

function handleTouchEnd(e) {
    clearTimeout(touchTimeout);

    if (isDragging && draggedTask && draggedElement) {
        const touch = e.changedTouches[0];

        // iOS fix: temporarily hide element for reliable elementFromPoint
        let elementBelow;
        if (isIOS) {
            draggedElement.style.display = 'none';
            elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
            draggedElement.style.display = '';
        } else {
            elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
        }

        const columnTasks = elementBelow?.closest('.column-tasks');

        if (columnTasks) {
            const newColumnId = columnTasks.dataset.columnId;
            const oldColumnId = draggedTask.columnId;
            moveTask(draggedTask.id, newColumnId, oldColumnId);
        }

        // Reset styles
        if (draggedElement) {
            draggedElement.classList.remove('dragging');
            draggedElement.style.position = '';
            draggedElement.style.zIndex = '';
            draggedElement.style.left = '';
            draggedElement.style.top = '';
            draggedElement.style.pointerEvents = '';
        }
    }

    isDragging = false;
    draggedTask = null;
    draggedElement = null;

    // Remove drag-over class from all columns
    document.querySelectorAll('.column-tasks').forEach(col => {
        col.classList.remove('drag-over');
    });
}

// Move task logic
function moveTask(taskId, newColumnId, oldColumnId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const oldColumn = getColumnById(oldColumnId);
    const newColumn = getColumnById(newColumnId);

    // Check if moving from Production (final state)
    if (oldColumn.isFinal) {
        // Create new task in backlog instead
        createNewTaskInBacklog();
        showConfetti();
        return;
    }

    // Update task
    task.columnId = newColumnId;

    // Update assignee based on column rules
    const assignees = newColumn.assignees || [];
    if (newColumn.assigneeMode === 'random' || assignees.length === 0) {
        task.teamId = getRandomTeam().id;
    } else if (assignees.length === 1) {
        task.teamId = assignees[0];
    } else {
        // Random from specified assignees
        task.teamId = assignees[Math.floor(Math.random() * assignees.length)];
    }

    // Update description
    task.description = getGreetingForTask(newColumnId, task.teamId);

    // Show effects based on column
    if (newColumn.isFinal) {
        // Production - confetti + new task
        showConfetti();
        createNewTaskInBacklog();
    } else {
        // Other columns - specific effects
        showEffectForColumn(newColumnId);
    }

    // Re-render
    renderTasks();
}

// Create new task in backlog
function createNewTaskInBacklog() {
    const backlogColumn = config.columns.find(c => c.id === 'backlog');
    if (!backlogColumn) return;

    const randomTeam = getRandomTeam();

    const newTask = {
        id: nextTaskId++,
        columnId: 'backlog',
        teamId: randomTeam.id,
        description: getGreetingForTask('backlog', randomTeam.id)
    };

    tasks.push(newTask);
    renderTasks();
}

// Show task modal
function showTaskModal(task) {
    const team = getTeamById(task.teamId);
    const column = getColumnById(task.columnId);

    const modal = document.getElementById('task-modal');
    document.getElementById('modal-team-photo').src = team.photo;
    document.getElementById('modal-team-name').textContent = team.name;
    document.getElementById('modal-description').textContent = task.description;
    document.getElementById('modal-status').textContent = column.title;
    document.getElementById('modal-status').style.background = team.color;

    modal.classList.add('show');

    // Show confetti if production
    if (column.isFinal) {
        showConfetti();
    }
}

// Setup modal
function setupModal() {
    const modal = document.getElementById('task-modal');
    const closeBtn = document.getElementById('close-modal');

    closeBtn.addEventListener('click', () => {
        modal.classList.remove('show');
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('show');
        }
    });

    // Close on Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('show')) {
            modal.classList.remove('show');
        }
    });
}

// Show confetti animation
function showConfetti() {
    const container = document.getElementById('confetti-container');
    const colors = ['#667eea', '#764ba2', '#48bb78', '#ed8936', '#f56565', '#ffd700'];

    for (let i = 0; i < 50; i++) {
        setTimeout(() => {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            confetti.style.left = Math.random() * 100 + '%';
            confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
            confetti.style.animationDelay = Math.random() * 0.5 + 's';
            confetti.style.animationDuration = (Math.random() * 2 + 2) + 's';

            container.appendChild(confetti);

            setTimeout(() => confetti.remove(), 3000);
        }, i * 30);
    }
}

// ============================================
// EFFECTS LIBRARY
// ============================================

// Effect registry - maps effect names to functions
const EFFECTS_LIBRARY = {
    // Column animation effects (apply CSS class to column)
    'shake': applyColumnEffect('shake-effect', 500),
    'pulse': applyColumnEffect('pulse-effect', 600),
    'glow': applyColumnEffect('glow-effect', 800),
    'glitch': applyColumnEffectWithVibration('glitch-effect', 600),
    'bounce': applyColumnEffect('bounce-effect', 600),
    'rotate': applyColumnEffect('rotate-effect', 600),
    'flash': applyColumnEffect('flash-effect', 900),
    'rainbow': applyColumnEffect('rainbow-effect', 1000),
    'zoom': applyColumnEffect('zoom-effect', 500),
    'slide': applyColumnEffect('slide-effect', 600),
    'fade': applyColumnEffect('fade-effect', 800),
    'wave': applyColumnEffect('wave-effect', 1000),
    'ripple': applyColumnEffect('ripple-effect', 1000),
    'spin': applyColumnEffect('spin-effect', 800),
    'swing': applyColumnEffect('swing-effect', 1000),
    'jello': applyColumnEffect('jello-effect', 900),
    'wobble': applyColumnEffect('wobble-effect', 800),
    'tada': applyColumnEffect('tada-effect', 1000),
    'flip': applyColumnEffect('flip-effect', 800),
    'rubber-band': applyColumnEffect('rubber-band-effect', 1000),
    'heartbeat': applyColumnEffect('heartbeat-effect', 1300),
    'neon-glow': applyColumnEffect('neon-glow-effect', 1000),

    // Particle effects (create animated particles)
    'confetti': showConfetti,
    'checkmarks': () => showParticleEffect('✓', 'checkmark', 15, 1000),
    'sparkles': () => showParticleEffect('✨', 'sparkle', 20, 1000),
    'hearts': () => showParticleEffect('❤️', 'heart', 12, 2000),
    'stars': () => showParticleEffect('⭐', 'star', 15, 1500),
    'bubbles': () => showBubblesEffect(),
    'snow': () => showParticleEffect('❄️', 'snowflake', 20, 3000),
    'lightning': () => showLightningEffect(),
    'fireworks': () => showFireworksEffect()
};

// List of all available effects for random selection
const ALL_EFFECTS = Object.keys(EFFECTS_LIBRARY);

// Helper: Create a function that applies CSS class to column
function applyColumnEffect(className, duration) {
    return function(columnId) {
        const column = document.querySelector(`.column-tasks[data-column-id="${columnId}"]`);
        if (!column) return;

        column.classList.add(className);
        setTimeout(() => column.classList.remove(className), duration);
    };
}

// Helper: Apply effect with vibration
function applyColumnEffectWithVibration(className, duration) {
    return function(columnId) {
        const column = document.querySelector(`.column-tasks[data-column-id="${columnId}"]`);
        if (!column) return;

        column.classList.add(className);

        // Haptic feedback if available
        if ('vibrate' in navigator) {
            navigator.vibrate([50, 50, 50]);
        }

        setTimeout(() => column.classList.remove(className), duration);
    };
}

// Generic particle effect
function showParticleEffect(symbol, className, count, duration) {
    const container = document.getElementById('effect-container');

    for (let i = 0; i < count; i++) {
        setTimeout(() => {
            const particle = document.createElement('div');
            particle.className = `particle ${className}`;
            particle.textContent = symbol;

            // Random starting position
            const startX = Math.random() * window.innerWidth;
            const startY = Math.random() * window.innerHeight;

            // Random direction
            const tx = (Math.random() - 0.5) * 200;
            const ty = (Math.random() - 0.5) * 200;

            particle.style.left = startX + 'px';
            particle.style.top = startY + 'px';
            particle.style.setProperty('--tx', tx + 'px');
            particle.style.setProperty('--ty', ty + 'px');

            container.appendChild(particle);

            setTimeout(() => particle.remove(), duration);
        }, i * 50);
    }
}

// Bubbles effect
function showBubblesEffect() {
    const container = document.getElementById('effect-container');

    for (let i = 0; i < 15; i++) {
        setTimeout(() => {
            const bubble = document.createElement('div');
            bubble.className = 'particle bubble';

            const startX = Math.random() * window.innerWidth;
            const drift = (Math.random() - 0.5) * 100;

            bubble.style.left = startX + 'px';
            bubble.style.top = window.innerHeight + 'px';
            bubble.style.setProperty('--drift', drift + 'px');

            container.appendChild(bubble);

            setTimeout(() => bubble.remove(), 3000);
        }, i * 100);
    }
}

// Lightning effect
function showLightningEffect() {
    const container = document.getElementById('effect-container');

    for (let i = 0; i < 5; i++) {
        setTimeout(() => {
            const lightning = document.createElement('div');
            lightning.className = 'lightning';
            lightning.style.left = Math.random() * window.innerWidth + 'px';
            lightning.style.top = '0px';

            container.appendChild(lightning);

            setTimeout(() => lightning.remove(), 300);
        }, i * 100);
    }
}

// Fireworks effect
function showFireworksEffect() {
    const container = document.getElementById('effect-container');
    const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#ffd700'];

    for (let burst = 0; burst < 3; burst++) {
        setTimeout(() => {
            const centerX = Math.random() * window.innerWidth;
            const centerY = Math.random() * (window.innerHeight / 2);

            for (let i = 0; i < 20; i++) {
                const particle = document.createElement('div');
                particle.className = 'firework-particle';
                particle.style.background = colors[Math.floor(Math.random() * colors.length)];
                particle.style.left = centerX + 'px';
                particle.style.top = centerY + 'px';

                const angle = (Math.PI * 2 * i) / 20;
                const velocity = 50 + Math.random() * 50;
                const tx = Math.cos(angle) * velocity;
                const ty = Math.sin(angle) * velocity;

                particle.style.setProperty('--tx', tx + 'px');
                particle.style.setProperty('--ty', ty + 'px');

                container.appendChild(particle);

                setTimeout(() => particle.remove(), 1000);
            }
        }, burst * 300);
    }
}

// Main function to show effect for a column
function showEffectForColumn(columnId) {
    const column = getColumnById(columnId);
    if (!column || !column.effect) return;

    let effectName = column.effect;

    // Handle "random" effect
    if (effectName === 'random') {
        effectName = ALL_EFFECTS[Math.floor(Math.random() * ALL_EFFECTS.length)];
        console.log(`Random effect selected: ${effectName}`);
    }

    // Execute the effect
    const effectFunction = EFFECTS_LIBRARY[effectName];
    if (effectFunction) {
        effectFunction(columnId);
    } else {
        console.warn(`Effect "${effectName}" not found in library`);
    }
}

// Error handler for images
document.addEventListener('error', (e) => {
    if (e.target.tagName === 'IMG') {
        console.warn('Image failed to load:', e.target.src);
    }
}, true);