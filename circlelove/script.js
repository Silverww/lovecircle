// ========================================
// 马子潇的恋爱循环 - Game Script
// ========================================

// Game State
const TOTAL_ENDINGS = 13;
const SAVE_KEY = 'GAL_SAVES';
const ENDINGS_KEY = 'GAL_ENDINGS_ARCHIVE';

let gameState = {
    currentNode: 'start',
    love: 20,
    obsession: 20,
    isBabyMode: false,
    unlockedNodes: ['start'],
    visitedNodes: [],
    textSpeed: 3,
    bgmVolume: 50,
    seVolume: 70,
    chosenChoices: {}
};

// Story Data
let storyData = null;

// Audio Manager
const audioManager = {
    bgm: null,
    se: null,
    currentSpeed: 1.0,

    playBGM(url = 'music/main_theme.mp3') {
        if (this.bgm) {
            // 已经在播放主旋律，则仅调速，不重新播放
            this.bgm.playbackRate = this.currentSpeed;
            return;
        }
        this.bgm = new Audio(url);
        this.bgm.loop = true;
        this.bgm.volume = gameState.bgmVolume / 100;
        this.bgm.playbackRate = this.currentSpeed;
        this.bgm.play().catch(() => {
            console.log('等待用户交互后播放音乐');
        });
    },

    // 核心新增：控制音乐速度的方法
    setSpeed(speed) {
        this.currentSpeed = speed;
        if (this.bgm) {
            this.bgm.playbackRate = speed;
        }
    },

    playClick(url = 'assets/sounds/click.mp3') {
        this.playSE(url);
    },

    playSE(url) {
        const se = new Audio(url);
        se.volume = gameState.seVolume / 100;
        se.play().catch(() => {});
    },
    setBGMVolume(vol) {
        if (this.bgm) this.bgm.volume = vol / 100;
    },
    setSEVolume(vol) {
        this.seVolume = vol;
    }
};

// DOM Elements
const screens = {
    title: document.getElementById('title-screen'),
    load: document.getElementById('load-screen'),
    gallery: document.getElementById('gallery-screen'),
    game: document.getElementById('game-screen')
};

const elements = {
    monologueBox: document.getElementById('monologue-box'),
    monologueText: document.getElementById('monologue-text'),
    dialogueBox: document.getElementById('dialogue-box'),
    speakerName: document.getElementById('speaker-name'),
    dialogueText: document.getElementById('dialogue-text'),
    choicePanel: document.getElementById('choice-panel'),
    flowchartContent: document.getElementById('flowchart-content'),
    saveSlots: document.getElementById('save-slots'),
    saveSlotsGame: document.getElementById('save-slots-game'),
    galleryGrid: document.getElementById('gallery-grid'),
    loveDisplay: document.getElementById('love-display'),
    obsessionDisplay: document.getElementById('obsession-display'),
    jybFloat: document.getElementById('jyb-float'),
    backgroundLayer: document.getElementById('background-layer'),
    characterLeft: document.getElementById('character-left'),
    characterRight: document.getElementById('character-right'),
    completionRateTitle: document.getElementById('completion-rate-title'),
    errorDisplay: document.getElementById('error-display'),
    errorMessage: document.getElementById('error-message'),
    settingsPanel: document.getElementById('settings-panel'),
    game: document.getElementById('game-screen')
};

// Character Emojis
const characterEmojis = {
    '马子潇': { normal: '(≧▽≦)', happy: '(≧◡≦)', nervous: '(´・ω・`)', thinking: '(。・ω・)' },
    '韦淼芊': { normal: '(・ω・)', curious: '(｡・ω・｡)', shy: '(//ω//)', cold: '(－ω－)', angry: '(>`ε´)' },
    'JYB': { normal: '(´-ω-`)', sad: '(´;ω;`)', deep: '(－‸－)', calm: '(・´ｪ・`)' },
    'CZH': { normal: '(>ωω<)', cool: '(¬_¬)', gaming: '(⌐■_■)' },
    'WYY': { normal: '(｡･ω･｡)', happy: '(◕‿◕)', shy: '(⁄ ⁄•⁄ω⁄•⁄ ⁄)' },
    'default': { normal: '(・ω・)' }
};

function getCharacterEmoji(speaker, mood = 'normal') {
    const chars = characterEmojis[speaker] || characterEmojis['default'];
    return chars[mood] || chars['normal'];
}

// Typewriter State
let typewriterTimer = null;
let isTyping = false;
let currentFullText = '';
let skipRequested = false;
let isChoiceLocked = false;
let isHandlingChoice = false;

// ========================================
// Initialization
// ========================================

async function init() {
    try {
        const response = await fetch('story.json');
        if (!response.ok) throw new Error('Failed to load story.json');
        storyData = await response.json();
        showTitleScreen();
        updateCompletionRate();
    } catch (error) {
        showError('无法加载游戏数据：' + error.message);
    }
}

function showError(message) {
    elements.errorMessage.textContent = message;
    elements.errorDisplay.classList.add('active');
}

// ========================================
// Screen Management
// ========================================

function showScreen(screenName) {
    Object.values(screens).forEach(screen => screen.classList.remove('active'));
    screens[screenName].classList.add('active');
}

function showTitleScreen() {
    showScreen('title');
    updateCompletionRate();
}

function showLoadScreen() {
    showScreen('load');
    renderSaveSlots();
}

function showGallery() {
    showScreen('gallery');
    renderGallery();
}

// ========================================
// Game Start / Load
// ========================================

function startNewGame() {
    gameState = {
        currentNode: 'start',
        love: 20,
        obsession: 20,
        isBabyMode: false,
        unlockedNodes: ['start'],
        visitedNodes: [],
        textSpeed: 3,
        bgmVolume: 50,
        seVolume: 70,
        chosenChoices: {}
    };
    showScreen('game');
    loadNode('start');
}

function loadGame(saveData) {
    gameState = {
        currentNode: saveData.current_node_id,
        love: saveData.love,
        obsession: saveData.obsession,
        isBabyMode: saveData.is_baby_mode,
        unlockedNodes: saveData.unlocked_nodes || ['start'],
        visitedNodes: saveData.visited_nodes || [],
        textSpeed: saveData.text_speed || 3,
        bgmVolume: saveData.bgm_volume || 50,
        seVolume: saveData.se_volume || 70,
        chosenChoices: saveData.chosen_choices || {}
    };
    showScreen('game');
    loadNode(gameState.currentNode);
}

// ========================================
// Node Loading
// ========================================

function loadNode(nodeId) {
    // Reset locks
    isChoiceLocked = false;
    isHandlingChoice = false;

    const node = storyData.scenes[nodeId];
    if (!node) {
        console.error('Node not found:', nodeId);
        return;
    }

    gameState.currentNode = nodeId;
    if (!gameState.visitedNodes.includes(nodeId)) {
        gameState.visitedNodes.push(nodeId);
    }

    // --- 自动音乐变速逻辑 ---
    if (node.ending) {
        const endingId = typeof node.ending === 'string' ? node.ending : nodeId;
        if (endingId.startsWith('HE')) {
            audioManager.setSpeed(1.2);
        } else if (endingId.startsWith('BE')) {
            audioManager.setSpeed(0.8);
        } else {
            audioManager.setSpeed(1.0);
        }
    } else {
        if (gameState.obsession > 70 || nodeId.includes('breakdown')) {
            audioManager.setSpeed(0.8);
        } else if (gameState.love > 70) {
            audioManager.setSpeed(1.1);
        } else {
            audioManager.setSpeed(1.0);
        }
    }

    // Ensure main theme is playing
    audioManager.playBGM();

    // 在进入新节点时锁定全局交互，防止打字过程中误触
    if (elements.game) {
        elements.game.style.pointerEvents = 'none';
    }

    // Update background
    if (node.background) {
        elements.backgroundLayer.style.backgroundImage = `url('backgrounds/${node.background}.jpg')`;
    }

    // Update characters
    updateCharacters(node.characters);

    // Update UI values
    updateStatsDisplay();

    // Check for baby mode
    gameState.isBabyMode = gameState.love >= 50;

    // Update dialogue box danger state
    updateDialogueBoxState();
    ensureDialogueBoxStructure();

    // Check for breaking BE mood effects (only when 韦淼芊 is speaking)
    const speaker = node.dialogue?.speaker || '';
    const isWMQ = speaker === '韦淼芊';
    if (isWMQ && (node.dialogue?.mood === 'angry' || node.dialogue?.mood === 'breakdown')) {
        triggerBreakingEffect(node.dialogue.mood);
    } else if (isWMQ && node.dialogue?.mood === 'sad' && gameState.obsession > 70) {
        triggerBreakingEffect('angry');
    } else {
        clearBreakingEffect();
    }

    // Clear previous content
    elements.monologueText.textContent = '';
    elements.dialogueText.textContent = '';
    elements.speakerName.textContent = '';
    elements.choicePanel.innerHTML = '';
    elements.choicePanel.style.display = 'none';
    elements.choicePanel.style.visibility = 'hidden';

    // Check for ending
    if (node.ending) {
        handleEnding(nodeId);
        return;
    }

    // Show monologue first
    if (node.monologue) {
        typewriterEffect(elements.monologueText, node.monologue, () => {
            elements.monologueBox.classList.add('visible');
            setTimeout(() => {
                showDialogue(node);
            }, 500);
        });
    } else {
        showDialogue(node);
    }

    // Update flowchart
    updateFlowchart();

    // Apply murder ending filter if needed
    if (nodeId === 'BE_Murder') {
        triggerMurderEnding();
    }

    // 故事推行器：如果当前节点不是结局节点，且打字完成后没有选项按钮，
    // 自动显示一个"继续..."按钮，点击后跳转到的下一个逻辑节点
    setTimeout(() => {
        const btns = elements.choicePanel.querySelectorAll('.choice-btn');
        if (btns.length === 0 && !node.ending && node.choices && node.choices.length > 0) {
            const btn = document.createElement('button');
            btn.className = 'choice-btn';
            btn.textContent = '继续...';
            btn.style.opacity = '1';
            btn.style.visibility = 'visible';
            btn.style.pointerEvents = 'auto';
            btn.onclick = (e) => {
                e.stopPropagation();
                e.preventDefault();
                // 使用剧本中的第一个选项的 next 作为跳转目标
                const firstChoice = node.choices[0];
                if (firstChoice && firstChoice.next) {
                    loadNode(firstChoice.next);
                }
            };
            elements.choicePanel.appendChild(btn);
            elements.choicePanel.style.display = '';
            elements.choicePanel.style.visibility = 'visible';
            elements.choicePanel.style.opacity = '1';
        }
    }, 600);
}

function showDialogue(node) {
    elements.dialogueBox.classList.remove('hidden');

    const finalDestination = (!node.choices || node.choices.length === 0) && !node.ending ? evaluateFinalEnding() : null;

    if (node.dialogue && node.dialogue.text) {
        const speaker = node.dialogue.speaker || '';
        const emoji = getCharacterEmoji(speaker, node.dialogue.mood || 'normal');
        elements.speakerName.innerHTML = speaker + '<span class="speaker-emoji">' + emoji + '</span>';
        
        // Apply breaking effects based on mood right before showing dialogue
        const isWMQ = speaker === '韦淼芊';
        if (isWMQ && (node.dialogue?.mood === 'angry' || node.dialogue?.mood === 'breakdown')) {
            triggerBreakingEffect(node.dialogue.mood);
        } else if (isWMQ && node.dialogue?.mood === 'sad' && gameState.obsession > 70) {
            triggerBreakingEffect('angry');
        } else {
            clearBreakingEffect();
        }
        
        typewriterEffect(elements.dialogueText, node.dialogue.text, () => {
            if (finalDestination) {
                loadNode(finalDestination);
            } else {
                showChoices(node.choices);
            }
        });
    } else {
        if (finalDestination) {
            loadNode(finalDestination);
        } else {
            showChoices(node.choices);
        }
    }
}

function showChoices(choices) {
    if (elements.game) {
        elements.game.style.pointerEvents = 'auto';
    }
    elements.choicePanel.innerHTML = '';
    elements.choicePanel.style.display = '';
    elements.choicePanel.style.visibility = 'visible';
    elements.choicePanel.style.opacity = '1';
    elements.choicePanel.style.zIndex = '100';

    skipRequested = false;

    if (!choices || choices.length === 0) return;

    choices.forEach((choice, index) => {
        const btn = document.createElement('button');
        btn.className = 'choice-btn';
        btn.textContent = replaceNames(choice.text);
        btn.style.opacity = '1';
        btn.style.visibility = 'visible';
        btn.style.pointerEvents = 'auto';
        btn.onclick = (e) => {
            e.stopPropagation();
            e.preventDefault();
            handleChoiceDirect(choice);
        };
        elements.choicePanel.appendChild(btn);
    });
}

// 脚本核心修复：彻底解决点击不跳转和死循环问题
function handleChoiceDirect(choice) {
    if (isHandlingChoice) return;
    isHandlingChoice = true;

    // 1. 立即销毁所有按钮，并锁定交互
    const panel = elements.choicePanel;
    while (panel.firstChild) {
        panel.removeChild(panel.firstChild);
    }
    panel.style.display = 'none';

    // 2. 停止打字机并强制清除旧文本
    if (typewriterTimer) {
        clearInterval(typewriterTimer);
        typewriterTimer = null;
    }
    isTyping = false;

    // 3. 核心修复：防止逻辑回环。
    // 如果剧情试图跳回 stable_relationship（那个导致循环感的节点），
    // 且当前正处于“和好”阶段，强制推向“生活推进”节点。
    let nextNodeId = choice.next;
    if (nextNodeId === 'stable_relationship' && gameState.currentNode === 'reconcile_scene') {
        nextNodeId = 'life_progression';
    }

    // 4. 自动纠错：如果 next 指向自己，强制寻找下一条剧情
    if (!nextNodeId || nextNodeId === gameState.currentNode) {
        const sceneIds = Object.keys(storyData.scenes);
        const currentIndex = sceneIds.indexOf(gameState.currentNode);
        nextNodeId = sceneIds[currentIndex + 1] || 'NE';
    }

    // 5. 应用数值变动
    if (choice.effects) {
        gameState.love = Math.max(0, Math.min(100, gameState.love + (choice.effects.love || 0)));
        gameState.obsession = Math.max(0, Math.min(100, gameState.obsession + (choice.effects.obsession || 0)));
        updateStatsDisplay();
    }

    // 触发点击声
    audioManager.playClick();

    // 6. 执行跳转
    loadNode(nextNodeId);
    
    // 7. 100ms 后释放处理锁
    setTimeout(() => {
        isHandlingChoice = false;
    }, 100);
}

// Keep old function for compatibility but it just delegates
function handleChoice(choice) {
    handleChoiceDirect(choice);
}

// All buttons except choice buttons use this universal click sound.
document.addEventListener('click', (e) => {
    const target = e.target;
    if (target.tagName === 'BUTTON' && !target.classList.contains('choice-btn')) {
        audioManager.playClick();
    }
});

// ========================================
// Typewriter Effect
// ========================================

function typewriterEffect(element, text, callback) {
    if (typewriterTimer) {
        clearInterval(typewriterTimer);
    }

    currentFullText = text;
    skipRequested = false;
    isTyping = true;

    let index = 0;
    const charsPerSecond = 20 * gameState.textSpeed;
    const interval = 1000 / charsPerSecond;

    element.textContent = '';

    // Disable choices during typing
    elements.choicePanel.style.pointerEvents = 'none';
    elements.choicePanel.querySelectorAll('.choice-btn').forEach(btn => btn.style.opacity = '0.5');

    typewriterTimer = setInterval(() => {
        if (!typewriterTimer) return;

        if (index < text.length) {
            element.textContent += text[index];
            index++;
        } else {
            clearInterval(typewriterTimer);
            typewriterTimer = null;
            isTyping = false;
            elements.choicePanel.style.pointerEvents = 'auto';
            elements.choicePanel.querySelectorAll('.choice-btn').forEach(btn => btn.style.opacity = '1');
            if (callback) callback();
        }
    }, interval);
}

// ========================================
// Dynamic Name Replacement
// ========================================

function replaceNames(text) {
    if (!text) return '';

    if (gameState.isBabyMode) {
        text = text.replace(/马子潇/g, '宝宝');
        text = text.replace(/韦淼芊/g, '宝宝');
        text = text.replace(/我/g, '小狗');
    }

    return text;
}

// ========================================
// Visual Effects
// ========================================

function updateDialogueBoxState() {
    const box = elements.dialogueBox;
    box.classList.remove('danger', 'panic', 'shaking', 'red-blue-flash');

    if (gameState.obsession > 80) {
        box.classList.add('panic');
    } else if (gameState.obsession > 50) {
        box.classList.add('danger');
    }
}

function ensureDialogueBoxStructure() {
    if (!elements.dialogueBox.querySelector('#speaker-name') || !elements.dialogueBox.querySelector('#dialogue-text')) {
        elements.dialogueBox.innerHTML = `
            <div class="speaker-name" id="speaker-name"></div>
            <p id="dialogue-text" class="dialogue-text"></p>
        `;
        elements.speakerName = document.getElementById('speaker-name');
        elements.dialogueText = document.getElementById('dialogue-text');
    }
}

function clearBreakingEffect() {
    const box = elements.dialogueBox;
    const monologue = elements.monologueBox;
    const speaker = elements.speakerName;

    box.classList.remove('shaking', 'red-blue-flash');
    monologue.classList.remove('breaking');
    speaker.classList.remove('danger-text');
}

function triggerBreakingEffect(type) {
    const box = elements.dialogueBox;
    const monologue = elements.monologueBox;
    const speaker = elements.speakerName;

    box.classList.remove('shaking', 'red-blue-flash');
    monologue.classList.remove('breaking');
    speaker.classList.remove('danger-text');

    if (type === 'angry') {
        box.classList.add('shaking');
        speaker.classList.add('danger-text');
    } else if (type === 'breakdown') {
        box.classList.add('red-blue-flash');
        monologue.classList.add('breaking');
        speaker.classList.add('danger-text');
    }
}

function updateCharacters(characters) {
    elements.characterLeft.className = 'character-sprite';
    elements.characterRight.className = 'character-sprite';

    if (characters) {
        if (characters.left) {
            elements.characterLeft.style.backgroundImage = `url('characters/${characters.left}.png')`;
            elements.characterLeft.classList.add('visible');
            if (characters.left === 'miaoqian' && gameState.obsession > 90) {
                elements.characterLeft.classList.add('dark');
            }
        }
        if (characters.right) {
            elements.characterRight.style.backgroundImage = `url('characters/${characters.right}.png')`;
            elements.characterRight.classList.add('visible');
            if (characters.right === 'miaoqian' && gameState.obsession > 90) {
                elements.characterRight.classList.add('dark');
            }
        }
    }
}

function triggerMurderEnding() {
    document.body.classList.add('murder-ending');
    audioManager.playSE('be_theme.mp3');
}

// ========================================
// Stats Display
// ========================================

function updateStatsDisplay() {
    elements.loveDisplay.textContent = `好感度: ${gameState.love}`;
    elements.obsessionDisplay.textContent = `占有欲: ${gameState.obsession}`;
}

// ========================================
// Flowchart
// ========================================

function updateFlowchart() {
    elements.flowchartContent.innerHTML = '';

    storyData.flowchart.forEach(node => {
        const nodeEl = document.createElement('div');
        nodeEl.className = 'flowchart-node';

        const isUnlocked = gameState.unlockedNodes.includes(node.id);
        const isCurrent = gameState.currentNode === node.id;

        let isLocked = true;
        if (node.id === 'start') {
            isLocked = false;
        } else if (isUnlocked || isCurrent) {
            isLocked = false;
        } else if (node.unlock_condition === 'true') {
            isLocked = false;
        }

        if (isCurrent) {
            nodeEl.classList.add('current');
        } else if (isLocked) {
            nodeEl.classList.add('locked');
        } else {
            nodeEl.classList.add('unlocked');
        }

        nodeEl.textContent = node.name;
        nodeEl.title = isLocked ? '未解锁' : node.name;

        if (!isLocked && !isCurrent) {
            nodeEl.onclick = () => loadNode(node.id);
        }

        elements.flowchartContent.appendChild(nodeEl);
    });
}

// ========================================
// Save / Load System
// ========================================

function getSaves() {
    const saves = localStorage.getItem(SAVE_KEY);
    return saves ? JSON.parse(saves) : [];
}

function saveGame(slotIndex) {
    const saves = getSaves();

    const node = storyData.scenes[gameState.currentNode];
    const sceneTitle = node ? (node.dialogue?.speaker || '') + ' - ' + (node.monologue?.substring(0, 20) || '') : 'Unknown';

    saves[slotIndex] = {
        current_node_id: gameState.currentNode,
        love: gameState.love,
        obsession: gameState.obsession,
        is_baby_mode: gameState.isBabyMode,
        unlocked_nodes: gameState.unlockedNodes,
        visited_nodes: gameState.visitedNodes,
        timestamp: Date.now(),
        scene_title: sceneTitle,
        background_name: node?.background || 'default',
        chosen_choices: gameState.chosenChoices
    };

    localStorage.setItem(SAVE_KEY, JSON.stringify(saves));
    closeSaveOverlay();
}

function loadSave(slotIndex) {
    const saves = getSaves();
    if (saves[slotIndex]) {
        loadGame(saves[slotIndex]);
    }
}

function deleteSave(slotIndex) {
    const saves = getSaves();
    saves[slotIndex] = null;
    localStorage.setItem(SAVE_KEY, JSON.stringify(saves));
    renderSaveSlots();
}

function renderSaveSlots() {
    const saves = getSaves();

    elements.saveSlots.innerHTML = '';

    for (let i = 0; i < 6; i++) {
        const slot = document.createElement('div');
        slot.className = 'save-slot';

        if (saves[i]) {
            const date = new Date(saves[i].timestamp);
            const dateStr = date.toLocaleDateString('zh-CN') + ' ' + date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

            slot.innerHTML = `
                <div class="save-slot-title">存档 ${i + 1}</div>
                <div class="save-slot-info">${dateStr}</div>
                <div class="save-slot-scene">${saves[i].scene_title || 'Unknown'}</div>
            `;
            slot.onclick = () => loadSave(i);
        } else {
            slot.classList.add('empty');
            slot.textContent = '+';
        }

        elements.saveSlots.appendChild(slot);
    }
}

function openSaveOverlay() {
    const saves = getSaves();
    elements.saveSlotsGame.innerHTML = '';

    for (let i = 0; i < 6; i++) {
        const slot = document.createElement('div');
        slot.className = 'save-slot';

        if (saves[i]) {
            const date = new Date(saves[i].timestamp);
            const dateStr = date.toLocaleDateString('zh-CN') + ' ' + date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

            slot.innerHTML = `
                <div class="save-slot-title">存档 ${i + 1}</div>
                <div class="save-slot-info">${dateStr}</div>
                <div class="save-slot-scene">${saves[i].scene_title || 'Unknown'}</div>
            `;
            slot.onclick = () => saveGame(i);
        } else {
            slot.classList.add('empty');
            slot.textContent = '+';
            slot.onclick = () => saveGame(i);
        }

        elements.saveSlotsGame.appendChild(slot);
    }

    document.getElementById('save-overlay').classList.add('active');
}

function closeSaveOverlay() {
    document.getElementById('save-overlay').classList.remove('active');
}

function openLoadScreen() {
    showScreen('load');
    renderSaveSlots();
}

// ========================================
// Endings System
// ========================================

function handleEnding(endingId) {
    if (elements.game) {
        elements.game.style.pointerEvents = 'auto';
    }

    const endings = getCollectedEndings();
    if (!endings.includes(endingId)) {
        endings.push(endingId);
        localStorage.setItem(ENDINGS_KEY, JSON.stringify(endings));
    }

    const endingData = storyData.endings.find(e => e.id === endingId);
    if (endingData) {
        elements.dialogueBox.innerHTML = `
            <div class="ending-title">【${endingData.type}】${endingData.name}</div>
            <div class="ending-description">${endingData.description}</div>
            <button class="btn btn-primary" onclick="showTitleScreen()">返回标题</button>
        `;
    }
}

function evaluateFinalEnding() {
    const love = gameState.love;
    const obs = gameState.obsession;

    if (obs >= 85) return 'BE_Breaking';
    if (obs >= 75 && love < 40) return 'BE_Murder';
    if (love >= 80 && obs <= 50) return 'HE_5';
    if (love >= 60) return 'HE_1';
    return 'NE';
}

function getCollectedEndings() {
    const endings = localStorage.getItem(ENDINGS_KEY);
    return endings ? JSON.parse(endings) : [];
}

function updateCompletionRate() {
    const endings = getCollectedEndings();
    const rate = ((endings.length / TOTAL_ENDINGS) * 100).toFixed(0);
    elements.completionRateTitle.textContent = `全结局收集进度：${rate}%`;
}

// ========================================
// Gallery
// ========================================

function renderGallery() {
    elements.galleryGrid.innerHTML = '';
    const endings = getCollectedEndings();

    storyData.endings.forEach(ending => {
        const item = document.createElement('div');
        const isUnlocked = endings.includes(ending.id);

        item.className = 'gallery-item' + (isUnlocked ? '' : ' locked');
        item.innerHTML = `
            <div class="gallery-item-name">${isUnlocked ? ending.name : '???'}</div>
            <div class="gallery-item-type">${ending.type}</div>
        `;

        elements.galleryGrid.appendChild(item);
    });
}

// ========================================
// Settings
// ========================================

function openSettings() {
    document.getElementById('settings-panel').classList.add('active');
    document.getElementById('text-speed').value = gameState.textSpeed;
    document.getElementById('bgm-volume').value = gameState.bgmVolume;
    document.getElementById('se-volume').value = gameState.seVolume;
}

function closeSettings() {
    gameState.textSpeed = parseInt(document.getElementById('text-speed').value);
    gameState.bgmVolume = parseInt(document.getElementById('bgm-volume').value);
    gameState.seVolume = parseInt(document.getElementById('se-volume').value);

    audioManager.setBGMVolume(gameState.bgmVolume);
    audioManager.setSEVolume(gameState.seVolume);

    document.getElementById('settings-panel').classList.remove('active');
}

function returnToTitle() {
    if (confirm('确定要返回标题画面吗？未保存的进度将丢失。')) {
        showTitleScreen();
    }
}

// ========================================
// Branch Viewer
// ========================================

function showBranchViewer() {
    const viewer = document.getElementById('branch-viewer');
    const treeContainer = document.getElementById('branch-tree');
    treeContainer.innerHTML = '';

    const allNodes = storyData.scenes;
    const rootNodes = [];

    const pointedTo = new Set();
    Object.values(allNodes).forEach(node => {
        if (node.choices) {
            node.choices.forEach(choice => {
                if (choice.next) pointedTo.add(choice.next);
            });
        }
    });

    Object.keys(allNodes).forEach(nodeId => {
        if (!pointedTo.has(nodeId) && !allNodes[nodeId].ending) {
            rootNodes.push(nodeId);
        }
    });

    const renderedNodes = new Set();
    const getNodeDisplayName = (nodeId) => {
        const fcNode = storyData.flowchart.find(n => n.id === nodeId);
        if (fcNode) return fcNode.name;
        const scene = allNodes[nodeId];
        if (!scene) return nodeId;
        return scene.dialogue?.speaker || scene.monologue?.substring(0, 12) || nodeId;
    };

    const renderNode = (nodeId, level, fromChoice = null) => {
        const node = allNodes[nodeId];
        if (!node || renderedNodes.has(nodeId)) return;
        if (level > 6) return;
        renderedNodes.add(nodeId);

        const div = document.createElement('div');
        const isVisited = gameState.visitedNodes.includes(nodeId);
        const isCurrent = gameState.currentNode === nodeId;
        const chosenText = gameState.chosenChoices[nodeId];
        const isEnding = node.ending;

        let className = 'branch-node ';
        if (isCurrent) {
            className += 'current ';
        } else if (isVisited) {
            className += 'visited ';
        } else {
            className += 'unvisited ';
        }

        const hasChildren = node.choices && node.choices.some(c => c.next);
        if (hasChildren) className += 'has-children ';

        className += 'branch-level-' + level;
        div.className = className;

        let displayText = getNodeDisplayName(nodeId);
        if (fromChoice) {
            displayText = '▸ ' + fromChoice;
        }
        if (chosenText) {
            displayText += ' <span class="branch-chosen">✓ ' + chosenText.substring(0, 15) + '</span>';
        }
        if (isEnding) {
            displayText += ' <span class="branch-end-marker">' + node.ending + '</span>';
        }

        div.innerHTML = displayText;
        div.style.cursor = (isVisited || isCurrent) ? 'pointer' : 'default';
        div.onclick = () => {
            if (isVisited || isCurrent) {
                if (confirm('跳转到该节点？当前进度将丢失。')) {
                    loadNode(nodeId);
                    closeBranchViewer();
                }
            }
        };

        treeContainer.appendChild(div);

        if (node.choices) {
            node.choices.forEach((choice, idx) => {
                if (choice.next) {
                    const choiceLabel = choice.text ? choice.text.substring(0, 12) : '选项' + (idx + 1);
                    renderNode(choice.next, level + 1, choiceLabel);
                }
            });
        }
    };

    const startNodes = [...new Set([...gameState.visitedNodes, 'start'])].slice(0, 15);
    startNodes.forEach(nodeId => {
        if (!renderedNodes.has(nodeId)) {
            renderNode(nodeId, 0);
        }
    });

    viewer.classList.add('active');
}

function closeBranchViewer() {
    document.getElementById('branch-viewer').classList.remove('active');
}

// ========================================
// Start Game
// ========================================

document.addEventListener('DOMContentLoaded', init);