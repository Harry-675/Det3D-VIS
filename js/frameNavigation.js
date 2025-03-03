import { getJsonFiles, getCurrentFileIndex, setCurrentFileIndex } from './fileHandler.js';
import { loadJsonFile } from './fileHandler.js';

export function updateFrameNavigation() {
    const frameNav = document.getElementById('frameNav');
    frameNav.innerHTML = '';
    
    const jsonFiles = getJsonFiles();
    const currentFileIndex = getCurrentFileIndex();
    const totalFrames = jsonFiles.length;
    const MAX_VISIBLE_FRAMES = 10;
    
    if (totalFrames <= MAX_VISIBLE_FRAMES) {
        for (let i = 0; i < totalFrames; i++) {
            addFrameNumber(frameNav, i);
        }
    } else {
        const halfVisible = Math.floor((MAX_VISIBLE_FRAMES - 2) / 2);
        
        for (let i = 0; i < halfVisible; i++) {
            addFrameNumber(frameNav, i);
        }
        
        addEllipsis(frameNav);
        
        for (let i = totalFrames - halfVisible; i < totalFrames; i++) {
            addFrameNumber(frameNav, i);
        }
    }
}

function addFrameNumber(container, index) {
    const frameNumber = document.createElement('div');
    const currentFileIndex = getCurrentFileIndex();
    frameNumber.className = 'frame-number' + (index === currentFileIndex ? ' active' : '');
    frameNumber.textContent = index + 1;
    frameNumber.onclick = () => {
        setCurrentFileIndex(index);
        updateFrameNavigation();
    };
    container.appendChild(frameNumber);
}

function addEllipsis(container) {
    const ellipsis = document.createElement('div');
    ellipsis.className = 'frame-ellipsis';
    ellipsis.textContent = '...';
    ellipsis.onclick = showFramePopup;
    container.appendChild(ellipsis);
}

function showFramePopup() {
    const popup = document.getElementById('framePopup');
    const grid = document.getElementById('frameGrid');
    grid.innerHTML = '';
    
    const jsonFiles = getJsonFiles();
    const currentFileIndex = getCurrentFileIndex();
    
    jsonFiles.forEach((_, index) => {
        const frameNumber = document.createElement('div');
        frameNumber.className = 'frame-number' + (index === currentFileIndex ? ' active' : '');
        frameNumber.textContent = index + 1;
        frameNumber.onclick = () => {
            loadJsonFile(jsonFiles[index]);
            updateFrameNavigation();
            popup.style.display = 'none';
        };
        grid.appendChild(frameNumber);
    });
    
    popup.style.display = 'block';
    
    setTimeout(() => {
        document.addEventListener('click', closePopup);
    }, 0);
}

function closePopup(e) {
    const popup = document.getElementById('framePopup');
    if (!popup.contains(e.target) && !e.target.classList.contains('frame-ellipsis')) {
        popup.style.display = 'none';
        document.removeEventListener('click', closePopup);
    }
}

export function loadPreviousFrame() {
    const currentFileIndex = getCurrentFileIndex();
    if (currentFileIndex > 0) {
        setCurrentFileIndex(currentFileIndex - 1);
        updateFrameNavigation();
    }
}

export function loadNextFrame() {
    const currentFileIndex = getCurrentFileIndex();
    const jsonFiles = getJsonFiles();
    if (currentFileIndex < jsonFiles.length - 1) {
        setCurrentFileIndex(currentFileIndex + 1);
        updateFrameNavigation();
    }
}