const GameModule = (function() {
    // --- Private State (Closure) ---
    let _score = 0;
    let _timeLeft = 10;
    let _timerId = null;
    let _gameActive = false;
    
    // DOM 요소 변수 (미리 선언만 함)
    let target, scoreDisplay, timeDisplay, gameContainer, gameOverScreen, startBtn;

    // --- Private Methods ---
    const increaseScore = () => {
        _score += 10;
        if(scoreDisplay) scoreDisplay.textContent = `Score: ${_score}`;
    };

    const moveTarget = () => {
        if (!_gameActive) return;
        const maxX = gameContainer.clientWidth - 50;
        const maxY = gameContainer.clientHeight - 50;
        
        const randomX = Math.floor(Math.random() * maxX);
        const randomY = Math.floor(Math.random() * maxY);
        
        target.style.left = `${randomX}px`;
        target.style.top = `${randomY}px`;
        target.style.display = 'block';
    };

    const sanitizeInput = (str) => {
        const tempDiv = document.createElement('div');
        tempDiv.textContent = str; 
        return tempDiv.innerHTML;
    };

    // --- Game Engine Class (Logic) ---
    class GameEngine {
        constructor() {
            this.handleTargetClick = this.handleTargetClick.bind(this);
            this.handleRestart = this.handleRestart.bind(this);
            this.handleSaveScore = this.handleSaveScore.bind(this);
        }

        // [중요] init에서 DOM 요소를 찾아야 안전합니다.
        init() {
            // DOM 요소 연결
            target = document.getElementById('target');
            scoreDisplay = document.getElementById('score-display');
            timeDisplay = document.getElementById('time-display');
            gameContainer = document.getElementById('game-container');
            gameOverScreen = document.getElementById('game-over-screen');
            startBtn = document.getElementById('start-btn');

            // 버튼 리스너 등록
            if(startBtn) {
                startBtn.addEventListener('click', () => this.startGame());
            }
        }

        startGame() {
            if (_gameActive) return;
            _gameActive = true;
            _score = 0;
            _timeLeft = 10;
            
            scoreDisplay.textContent = "Score: 0";
            timeDisplay.textContent = "Time: 10";
            startBtn.style.display = 'none';
            gameOverScreen.style.display = 'none'; 

            target.addEventListener('mousedown', this.handleTargetClick);
            moveTarget();
            
            _timerId = setInterval(() => {
                _timeLeft--;
                timeDisplay.textContent = `Time: ${_timeLeft}`;
                if (_timeLeft <= 0) {
                    this.endGame();
                }
            }, 1000);
        }

        handleTargetClick(e) {
            increaseScore();
            moveTarget();
        }

        endGame() {
            _gameActive = false;
            clearInterval(_timerId);
            target.removeEventListener('mousedown', this.handleTargetClick);
            target.style.display = 'none';
            this.showGameOver();
        }

        showGameOver() {
            gameOverScreen.style.display = 'flex';
            document.getElementById('final-score').textContent = _score;
            
            document.getElementById('restart-btn').addEventListener('click', this.handleRestart, { once: true });
            document.getElementById('save-btn').addEventListener('click', this.handleSaveScore, { once: true });
        }

        handleSaveScore() {
            const input = document.getElementById('username');
            const rawName = input.value;
            const board = document.getElementById('high-score-board');
            const safeName = sanitizeInput(rawName); 
            
            if(safeName.trim() === "") return;

            board.innerHTML += `<div>Name: ${safeName} | Score: ${_score}</div>`;
            input.value = ''; 
            alert("Score Saved!");
        }

        handleRestart() {
            this.startGame();
        }
    }

    const engine = new GameEngine();
    return {
        init: engine.init.bind(engine)
    };

})();

// [중요] HTML이 모두 로드된 후 실행 (가장 안전한 방법)
document.addEventListener('DOMContentLoaded', () => {
    GameModule.init();
});