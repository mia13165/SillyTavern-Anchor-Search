import {
    processDroppedFiles,
    callPopup
} from "../../../../script.js";
import { debounce } from "../../../utils.js";
import { extension_settings } from "../../../extensions.js";

const API_ENDPOINT = "https://raw.githubusercontent.com/mia13165/Cards/refs/heads/main";
const MARES_ENDPOINT = `${API_ENDPOINT}/cards.json`;
const FILTERS_ENDPOINT = `${API_ENDPOINT}/filters.json`;

const CATEGORIES = [];

const TAGS = [{
    id: 'Female',
    label: 'Female',
    color: '#ffb6c1'
}, {
    id: 'NSFW',
    label: 'NSFW',
    color: '#ff6b6b'
}, {
    id: 'OC',
    label: 'OC',
    color: '#ffc182'
}, {
    id: 'Roleplay',
    label: 'Roleplay',
    color: '#e2b5ff'
}, {
    id: 'Human',
    label: 'Human',
    color: '#d4a373'
}, {
    id: 'Fantasy',
    label: 'Fantasy',
    color: '#98e8e8'
}, {
    id: 'anypov',
    label: 'AnyPOV',
    color: '#a8e4ff'
}, {
    id: 'Romance',
    label: 'Romance',
    color: '#ff9ecd'
}, {
    id: 'Male',
    label: 'Male',
    color: '#7ba7ff'
}, {
    id: 'Scenario',
    label: 'Scenario',
    color: '#ffd351'
}, {
    id: 'Cute',
    label: 'Cute',
    color: '#ffe066'
}, {
    id: 'Dominant',
    label: 'Dominant',
    color: '#ff8080'
}, {
    id: 'Love',
    label: 'Love',
    color: '#dda5dd'
}, {
    id: 'SFW <-> NSFW',
    label: 'SFW <-> NSFW',
    color: '#9ed5ff'
}, {
    id: 'English',
    label: 'English',
    color: '#c8a4ff'
}, {
    id: 'Submissive',
    label: 'Submissive',
    color: '#90b890'
}, {
    id: 'Original Character',
    label: 'Original Character',
    color: '#ffb3b3'
}, {
    id: 'Loli',
    label: 'Loli',
    color: '#b3997a'
}, ].map(tag => ({ ...tag,
        selected: false
}));

const defaultSettings = {
    findCount: 30,
    defaultSort: 'dateupdate',
    showNSFW: true,
    cacheEnabled: true,
    autoLoadTags: true,
    showTagCount: true,
    customTags: [],
    };
    
let mlpcharacters = [];
let characterListContainer = null;
let selectedTags = [];
let excludedTags = [];
let tagCounts = {};
let cachedData = null;
let lastFetchTime = 0;
let batchMode = false;
let selectedPaths = [];
const CACHE_DURATION = 5 * 60 * 1000;
let currentPage = 1;
let totalPages = 1;

function sanitizeText(text) {
    if (!text) return '';
    return text
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

async function loadSettings() {
    if (!extension_settings.mlpchag) {
        extension_settings.mlpchag = {};
    }

    for (const [key, value] of Object.entries(defaultSettings)) {
        if (!extension_settings.mlpchag.hasOwnProperty(key)) {
            extension_settings.mlpchag[key] = value;
        }
    }

    return extension_settings.mlpchag;
}

async function downloadCharacter(cardPath) {
    try {
        const character = mlpcharacters.find(char => char.path === cardPath);

        if (!character || !character.image_url) {
            throw new Error('Character image URL not found');
        }

        const imageUrl = character.image_url;
        const response = await fetch(imageUrl);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const blob = await response.blob();
        const file = new File([blob], cardPath, {
            type: 'image/png'
        });

        processDroppedFiles([file]);
        toastr.success('Character downloaded successfully', '', {
            timeOut: 2000
        });
    } catch (error) {
        toastr.error('Failed to download character');
    }
}

function getRandomCharacter() {
    if (!mlpcharacters || mlpcharacters.length === 0) {
        return null;
    }

    const filteredCharacters = [...mlpcharacters];

    if (filteredCharacters.length === 0) {
        return null;
    }

    const randomIndex = Math.floor(Math.random() * filteredCharacters.length);
    return filteredCharacters[randomIndex];
}

function createPreviewModal(character) {
    return `
    <div class="character-preview-modal">
        <div class="preview-content">
            <div class="preview-image-section">
                <img src="${sanitizeText(character.url)}" alt="${sanitizeText(character.name)}" class="preview-image">
                <div class="preview-header">
                    <h2 class="preview-name">${sanitizeText(character.name)}</h2>
                    <p class="preview-author">by ${sanitizeText(character.author)}</p>
        </div>
                <a href="#" class="download-button" data-path="${sanitizeText(character.path)}">
                    <i class="fa-solid fa-download"></i> Download
                </a>
            </div>

            <div class="preview-sections">
                ${character.description ? `
                    <div class="preview-section">
                        <div class="section-header">
                            <h3>Description</h3>
                        </div>
                        <div class="section-content">
                            <p>${sanitizeText(character.description)}</p>
                        </div>
                    </div>
                ` : ''}

                ${character.personality ? `
                    <div class="preview-section">
                        <div class="section-header">
                            <h3>Personality</h3>
                        </div>
                        <div class="section-content">
                            <p>${sanitizeText(character.personality)}</p>
                        </div>
                    </div>
                ` : ''}

                ${character.scenario ? `
                    <div class="preview-section">
                        <div class="section-header">
                            <h3>Scenario</h3>
                        </div>
                        <div class="section-content">
                            <p>${sanitizeText(character.scenario)}</p>
                        </div>
                    </div>
                ` : ''}

                ${character.greetings ? `
                    <div class="preview-section">
                        <div class="section-header">
                            <h3>Greetings</h3>
                        </div>
                        <div class="section-content greetings-content">
                            ${Array.isArray(character.greetings) ?
                                character.greetings.map((greeting, index) => `
                                    <div class="greeting ${index === 0 ? 'active' : ''}">${sanitizeText(greeting)}</div>
                                `).join('') :
                                `<div class="greeting active">${sanitizeText(character.greetings)}</div>`
}
                            ${Array.isArray(character.greetings) && character.greetings.length > 1 ? `
                                <div class="greeting-nav">
                                    ${character.greetings.map((_, index) => `
                                        <button class="greeting-dot ${index === 0 ? 'active' : ''}"
                                                data-index="${index}">
                                            ${index + 1}
        </button>
                                    `).join('')}
                                </div>
                            ` : ''}
                        </div>
                    </div>
                ` : ''}
            </div>

            <div class="return-section" style="margin-top: 15px;">
                <button class="return-button">
                    <i class="fa-solid fa-arrow-left"></i> Return to List
                </button>
            </div>
        </div>
    </div>`;
}

function updateCharacterListInView(characters) {
    if (!characterListContainer) return;

    const characterElements = characters.map(char => {
        try {
            if (!char.name || !char.author) {
                return '';
            }

            const tagElements = char.tags ? `
                <div class="character-tags">
                    ${char.tags.map(tag => {
                        const isExcluded = excludedTags.includes(tag);
                        const isSelected = selectedTags.includes(tag);
                        return `
                            <span class="character-tag ${isExcluded ? 'excluded-tag' : ''} ${isSelected ? 'selected-tag' : ''}"
                                  data-tag="${sanitizeText(tag)}">
                                ${sanitizeText(tag)} ${tagCounts[tag] ? `(${tagCounts[tag]})` : ''}
                            </span>
                        `;
                    }).join('')}
                </div>
            ` : '';

            return `
                <div class="character-list-item">
                    ${batchMode ? `<input type="checkbox" class="char-select" data-path="${sanitizeText(char.path)}" ${selectedPaths.includes(char.path) ? 'checked' : ''}>` : ''}
                    <img class="thumbnail"
                        src="${sanitizeText(char.url)}"
                        onerror="this.src='img/ai4.png'"
                        alt="${sanitizeText(char.name)}">
                    <div class="info">
                        <div class="name">${sanitizeText(char.name)}</div>
                        <div class="author">by ${sanitizeText(char.author)}</div>
                        <div class="description">${sanitizeText(char.description || '')}</div>
                        ${tagElements}
                    </div>
                    <div class="download-btn fa-solid fa-download"
                        data-path="${sanitizeText(char.path)}"
                        title="Download ${sanitizeText(char.name)}">
                    </div>
                </div>
            `;
        } catch (error) {
            return '';
        }
    }).filter(Boolean);

    if (characterElements.length === 0) {
        characterListContainer.innerHTML = '<div class="no-characters-found">No valid characters found</div>';
        return;
    }

    characterListContainer.innerHTML = characterElements.join('');
    updateTagCountDisplay();
}

async function handleCharacterListClick(event) {
    if (event.target.classList.contains('char-select')) {
        const checkbox = event.target;
        const path = checkbox.dataset.path;
        if (checkbox.checked) {
            if (!selectedPaths.includes(path)) {
                selectedPaths.push(path);
            }
        } else {
            selectedPaths = selectedPaths.filter(p => p !== path);
        }
        return;
    } else if (event.target.classList.contains('download-btn')) {
        downloadCharacter(event.target.getAttribute('data-path'));
    } else {
        const listItem = event.target.closest('.character-list-item');
        if (listItem) {
            await handleCharacterPreview(listItem);
        }
    }
}

async function handleCharacterPreview(listItem) {
    const path = listItem.querySelector('.download-btn').getAttribute('data-path');
    try {
        const character = mlpcharacters.find(char => char.path === path);
        if (character) {
            const modal = createPreviewModal(character);
            callPopup(modal, 'html');

            setupPreviewModalInteractions();
        }
    } catch (error) {}
}

function setupPreviewModalInteractions() {
    const modalElement = document.querySelector('.character-preview-modal');
    if (!modalElement) return;

    modalElement.querySelectorAll('.greeting-dot').forEach(dot => {
        dot.addEventListener('click', () => {
            const index = parseInt(dot.dataset.index);
            const section = dot.closest('.greetings-content');

            section.querySelectorAll('.greeting').forEach(greeting => {
                greeting.classList.remove('active');
            });
            section.querySelectorAll('.greeting')[index].classList.add('active');

            section.querySelectorAll('.greeting-dot').forEach(d => {
                d.classList.remove('active');
            });
            dot.classList.add('active');
        });
    });

    modalElement.querySelector('.download-button')?.addEventListener('click', (e) => {
        e.preventDefault();
        const path = e.target.closest('.download-button').dataset.path;
        downloadCharacter(path);
    });

    const returnBtn = modalElement.querySelector('.return-button');
    if (returnBtn) {
        returnBtn.addEventListener('click', (e) => {
            e.preventDefault();
            displayCharactersInListViewPopup();
        });
    }
}

function updateTagCountDisplay() {
    if (!extension_settings.mlpchag.showTagCount) {
        document.querySelectorAll('.tag-count').forEach(span => {
            span.style.display = 'none';
        });
        return;
    }

    document.querySelectorAll('.tag-button').forEach(button => {
        const tagId = button.dataset.tag;
        const count = tagCounts[tagId] || 0;
        const countSpan = button.querySelector('.tag-count');

        if (countSpan) {
            countSpan.textContent = `(${count})`;
            countSpan.style.display = 'inline';
        }
    });

    document.querySelectorAll('.category-button').forEach(button => {
        const categoryId = button.dataset.tag;
        const count = tagCounts[categoryId] || 0;
        const countSpan = button.querySelector('.tag-count');

        if (countSpan) {
            countSpan.textContent = `(${count})`;
            countSpan.style.display = 'inline';
        }
    });
}

async function fetchCharactersBySearch({
    searchTerm,
    searchType = 'name',
    page = 1,
    forceReload = false
}) {
    try {
        const now = Date.DATE_NODE;
        const shouldUseCache = !forceReload &&
            extension_settings.mlpchag.cacheEnabled &&
            cachedData &&
            (now - lastFetchTime < CACHE_DURATION);

        let maresData, filters;

        if (shouldUseCache) {
            [maresData, filters] = cachedData;
        } else {
            if (characterListContainer) {
                characterListContainer.innerHTML = '<div class="loading-spinner"><div class="spinner"></div><p>Loading characters...</p></div>';
            }

            try {
                const [maresResponse, filtersResponse] = await Promise.all([
                    fetch(MARES_ENDPOINT, {
                        cache: "no-cache"
                    }),
                    fetch(FILTERS_ENDPOINT, {
                        cache: "no-cache"
                    })
                ]);

                if (!maresResponse.ok) {
                    throw new Error(`Failed to fetch characters: ${maresResponse.status} ${maresResponse.statusText}`);
                }
                if (!filtersResponse.ok) {
                    throw new Error(`Failed to fetch filters: ${filtersResponse.status} ${filtersResponse.statusText}`);
                }

                [maresData, filters] = await Promise.all([
                    maresResponse.json(),
                    filtersResponse.json()
                ]);

                cachedData = [maresData, filters];
                lastFetchTime = now;
            } catch (error) {
                if (characterListContainer) {
                    characterListContainer.innerHTML = `<div class="error">Error fetching data: ${error.message}</div>`;
                }
                throw error;
            }
        }

        let allCharacters = Object.entries(maresData)
            .filter(([key, value]) => {
                if (!value || typeof value !== 'object' || !value.name || !value.author || value.error) {
                    return false;
                }
                return true;
            })
            .map(([key, value]) => {
                const normalizedKey = key.replace(/\\/g, '/');
                const backslashKey = key.replace(/\//g, '\\');

                return {
                    ...value,
                    path: key,
                    url: value.image_url || 'img/ai4.png',
                    name: value.name || 'Unknown',
                    author: value.author || 'Unknown',
                    description: value.description || '',
                    dateupdate: value.dateupdate || new Date().toISOString(),
                    datecreate: value.datecreate || value.dateupdate || new Date().toISOString(),
                    tags: filters.tags[normalizedKey] || filters.tags[backslashKey] || [],
                    categories: CATEGORIES.filter(category => {
                        const categoryPaths = filters[category.id] || [];
                        return categoryPaths.some(path =>
                            path.replace(/\\/g, '/') === normalizedKey);
                    }).map(c => c.id)
                };
            });

        mlpcharacters = [...allCharacters];
        updateTagCounts(allCharacters, filters);

        let filteredCharacters = [...allCharacters];

        if (!extension_settings.mlpchag.showNSFW) {
            const nsfwPaths = filters['nsfw'] || [];
            filteredCharacters = filteredCharacters.filter(char => {
                const normalizedPath = char.path.replace(/\\/g, '/');
                return !nsfwPaths.some(path => {
                    const normalizedFilterPath = path.replace(/\\/g, '/');
                    return normalizedFilterPath === normalizedPath;
                });
            });
        }

        const selectedCategories = selectedTags.filter(tag =>
            CATEGORIES.some(cat => cat.id === tag));

        if (selectedCategories.length > 0) {
            if (selectedCategories.includes('NSFW')) {
                const nsfwPaths = filters['nsfw'] || [];
                filteredCharacters = filteredCharacters.filter(char => {
                    const normalizedPath = char.path.replace(/\\/g, '/');
                    const isNSFW = nsfwPaths.some(path => {
                        const normalizedFilterPath = path.replace(/\\/g, '/');
                        return normalizedFilterPath === normalizedPath;
                    });

                    return isNSFW;
                });
            } else {
                filteredCharacters = filteredCharacters.filter(char => {
                    const normalizedPath = char.path.replace(/\\/g, '/');
                    return selectedCategories.some(category => {
                        const categoryPaths = filters[category] || [];
                        return categoryPaths.some(path => {
                            const normalizedFilterPath = path.replace(/\\/g, '/');
                            return normalizedFilterPath === normalizedPath;
                        });
                    });
                });
            }
        }

        const selectedRegularTags = selectedTags.filter(tag =>
            !CATEGORIES.some(cat => cat.id === tag));

        if (selectedRegularTags.length > 0) {
            filteredCharacters = filteredCharacters.filter(char => {
                return selectedRegularTags.every(tag =>
                    char.tags.some(cardTag =>
                        cardTag.toLowerCase() === tag.toLowerCase()
                    )
                );
            });
        }

        const excludedRegularTags = excludedTags.filter(tag =>
            !CATEGORIES.some(cat => cat.id === tag));

        if (excludedRegularTags.length > 0) {
            filteredCharacters = filteredCharacters.filter(char => {
                return !excludedRegularTags.some(tag =>
                    char.tags.some(cardTag =>
                        cardTag.toLowerCase() === tag.toLowerCase()
                    )
                );
            });
        }

        const excludedCategories = excludedTags.filter(tag =>
            CATEGORIES.some(cat => cat.id === tag));

        if (excludedCategories.length > 0) {
            filteredCharacters = filteredCharacters.filter(char => {
                const normalizedPath = char.path.replace(/\\/g, '/');
                return !excludedCategories.some(category => {
                    if (category === 'NSFW') {
                        const nsfwPaths = filters['nsfw'] || [];
                        return nsfwPaths.some(path => {
                            const normalizedFilterPath = path.replace(/\\/g, '/');
                            return normalizedFilterPath === normalizedPath;
                        });
                    } else {
                        const categoryPaths = filters[category] || [];
                        return categoryPaths.some(path => {
                            const normalizedFilterPath = path.replace(/\\/g, '/');
                            return normalizedFilterPath === normalizedPath;
                        });
                    }
                });
            });
        }

        if (searchTerm) {
            const regexMatch = searchTerm.match(/^\/(.+?)\/([gimsuvy]*)$/);

            if (regexMatch) {
                try {
                    const [, pattern, flags] = regexMatch;
                    const regex = new RegExp(pattern, flags);

                    filteredCharacters = filteredCharacters.filter(char => {
                        switch (searchType) {
                            case 'name':
                                return regex.test(char.name);
                            case 'description':
                                return char.description && regex.test(char.description);
                            case 'author':
                                return regex.test(char.author);
                            default:
                                return regex.test(char.name) || regex.test(char.author);
                        }
                    });
                } catch (e) {
                    const term = searchTerm.toLowerCase();
                    filteredCharacters = filteredCharacters.filter(char => {
                        switch (searchType) {
                            case 'name':
                                return char.name.toLowerCase().includes(term);
                            case 'description':
                                return char.description && char.description.toLowerCase().includes(term);
                            case 'author':
                                return char.author.toLowerCase().includes(term);
                            default:
                                return char.name.toLowerCase().includes(term) ||
                                    char.author.toLowerCase().includes(term);
                        }
                    });
                }
            } else {
                const term = searchTerm.toLowerCase();
                filteredCharacters = filteredCharacters.filter(char => {
                    switch (searchType) {
                        case 'name':
                            return char.name.toLowerCase().includes(term);
                        case 'description':
                            return char.description && char.description.toLowerCase().includes(term);
                        case 'author':
                            return char.author.toLowerCase().includes(term);
                        default:
                            return char.name.toLowerCase().includes(term) ||
                                char.author.toLowerCase().includes(term);
                    }
                });
            }
        } else if (searchType === 'description') {
            filteredCharacters = filteredCharacters.filter(char =>
                char.description && char.description.trim() !== '');
        }

        applySorting(filteredCharacters);

        const resultCountSpan = document.getElementById('resultCount');
        if (resultCountSpan) {
            resultCountSpan.textContent = filteredCharacters.length;
        }

        const paginatedResults = paginateResults(filteredCharacters, page);

        if (paginatedResults.length === 0 && page > 1 && filteredCharacters.length > 0) {
            const maxPage = Math.ceil(filteredCharacters.length / extension_settings.mlpchag.findCount);
            return paginateResults(filteredCharacters, maxPage);
        }

        return paginatedResults;

    } catch (error) {
        if (characterListContainer) {
            characterListContainer.innerHTML = `<div class="error">Error: ${error.message}</div>`;
        }
        throw error;
    }
}

function updateTagCounts(characters, filters) {
    tagCounts = {};

    CATEGORIES.forEach(category => {
        const categoryId = category.id;
        const categoryPaths = filters[categoryId] || [];

        tagCounts[categoryId] = characters.filter(char => {
            const normalizedPath = char.path.replace(/\\/g, '/');
            return categoryPaths.some(path =>
                path.replace(/\\/g, '/') === normalizedPath);
        }).length;
    });

    characters.forEach(char => {
        if (Array.isArray(char.tags)) {
            char.tags.forEach(tag => {
                tagCounts[tag] = (tagCounts[tag] || 0) + 1;
            });
        }
    });
}

function applySorting(characters) {
    const sortSelect = document.getElementById('sortSelect');
    if (!sortSelect) return;

    const sortType = sortSelect.value;
    characters.sort((a, b) => {
        switch (sortType) {
            case 'name':
                return a.name.localeCompare(b.name);
            case 'author':
                return a.author.localeCompare(b.author);
            case 'datecreate':
                return new Date(b.datecreate) - new Date(a.datecreate);
            default:
                return new Date(b.dateupdate) - new Date(a.dateupdate);
        }
    });
}

function paginateResults(characters, page) {
    const itemsPerPage = extension_settings.mlpchag.findCount;
    totalPages = Math.max(1, Math.ceil(characters.length / itemsPerPage));

    page = Math.max(1, Math.min(page, totalPages));
    currentPage = page;

    const start = (page - 1) * itemsPerPage;
    const end = Math.min(start + itemsPerPage, characters.length);

    const pageNumberInput = document.getElementById('pageNumberInput');
    const totalPagesSpan = document.getElementById('totalPages');

    if (pageNumberInput) {
        pageNumberInput.value = page;
    }

    if (totalPagesSpan) {
        totalPagesSpan.textContent = totalPages;
    }

    return characters.slice(start, end);
}

async function executeCharacterSearch(options) {
    try {
        const characters = await fetchCharactersBySearch(options);

        if (characters && characters.length > 0) {
            updateCharacterListInView(characters);
            return characters;
        } else {
            handleNoSearchResults(options);
            return [];
        }
    } catch (error) {
        if (characterListContainer) {
            characterListContainer.innerHTML = '<div class="error">Error loading characters</div>';
        }
        return [];
    }
}

function handleNoSearchResults(options) {
    if (options.page === 1) {
        characterListContainer.innerHTML = '<div class="no-characters-found">No characters found matching your criteria</div>';
    } else {
        const prevPage = options.page - 1;
        document.getElementById('pageNumberInput').value = prevPage;
        executeCharacterSearch({ ...options,
            page: prevPage
        });
    }
}

function setupTagHandlers() {
    const allFilterButtons = document.querySelectorAll('.tag-button, .category-button');
    allFilterButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-tag')) return;

            const tagId = button.dataset.tag;

            if (e.shiftKey) {
                if (excludedTags.includes(tagId)) {
                    excludedTags = excludedTags.filter(t => t !== tagId);
                    button.classList.remove('excluded');
                } else {
                    excludedTags.push(tagId);
                    button.classList.add('excluded');
                    selectedTags = selectedTags.filter(t => t !== tagId);
                    button.classList.remove('selected');
                }
            } else {
                if (selectedTags.includes(tagId)) {
                    selectedTags = selectedTags.filter(t => t !== tagId);
                    button.classList.remove('selected');
                } else {
                    selectedTags.push(tagId);
                    button.classList.add('selected');
                    excludedTags = excludedTags.filter(t => t !== tagId);
                    button.classList.remove('excluded');
                }
            }

            resetPageAndSearch();
        });

        button.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const tagId = button.dataset.tag;

            if (excludedTags.includes(tagId)) {
                excludedTags = excludedTags.filter(t => t !== tagId);
                button.classList.remove('excluded');
            } else {
                excludedTags.push(tagId);
                button.classList.add('excluded');
                selectedTags = selectedTags.filter(t => t !== tagId);
                button.classList.remove('selected');
            }

            resetPageAndSearch();
        });
    });

    document.querySelectorAll('.remove-tag').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const tagId = btn.dataset.tagId;
            removeCustomTag(tagId);
        });
    });

    const addTagButton = document.getElementById('addTagButton');
    const newTagInput = document.getElementById('newTagInput');

    if (addTagButton && newTagInput) {
        addTagButton.addEventListener('click', () => {
            addCustomTag(newTagInput.value);
            newTagInput.value = '';
        });

        newTagInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                addCustomTag(newTagInput.value);
                newTagInput.value = '';
            }
        });
    }

    document.querySelector('.clear-tags-button')?.addEventListener('click', () => {
        selectedTags = [];
        excludedTags = [];
        document.querySelectorAll('.tag-button, .category-button').forEach(btn => {
            btn.classList.remove('selected');
            btn.classList.remove('excluded');
        });
        resetPageAndSearch();
    });
}

function resetPageAndSearch() {
    currentPage = 1;

    const pageNumberInput = document.getElementById('pageNumberInput');
    if (pageNumberInput) {
        pageNumberInput.value = '1';
    }

    executeCharacterSearch({
        searchTerm: document.getElementById('characterSearchInput')?.value || '',
        searchType: document.getElementById('searchTypeSelect')?.value || 'name',
        page: 1
    });
}

async function displayCharactersInListViewPopup() {
    const listLayout = generateListLayout();
    callPopup(listLayout, 'text', '', {
        wide: true
    });

    characterListContainer = document.querySelector('.character-list-popup');
    if (characterListContainer && !characterListContainer.dataset.listenerAttached) {
        characterListContainer.addEventListener('click', handleCharacterListClick);
        characterListContainer.dataset.listenerAttached = 'true';
    }
    setupTagHandlers();
    await initializeSearchAndNavigation();
}

function generateListLayout() {
    return `
    <div class="mlpchag-popup">
        <div class="search-header">
            <div class="search-controls">
                <div class="search-bar">
                    <div class="search-input-container">
                        <button id="searchTypeButton" class="search-type-button">
                            <span id="currentSearchType">Search by Name</span>
                            <i class="fa-solid fa-caret-down"></i>
                        </button>
                        <div id="searchTypeDropdown" class="search-type-dropdown" style="display: none;">
                            <div class="dropdown-option" data-value="name">Search by Name</div>
                            <div class="dropdown-option" data-value="description">Search by Description</div>
                            <div class="dropdown-option" data-value="author">Search by Author</div>
                        </div>
                        <input type="text" id="characterSearchInput" placeholder="Search by character name...">
                    </div>
                    <select id="sortSelect" class="sort-select">
                        <option value="dateupdate">Latest Updated</option>
                        <option value="datecreate">Latest Created</option>
                        <option value="name">Name (A-Z)</option>
                        <option value="author">Author (A-Z)</option>
                    </select>
                </div>
                <div class="action-buttons">
                    <button id="randomCharacterBtn" class="action-button">
                        <i class="fa-solid fa-dice"></i> Random
                    </button>
                    <button id="settingsToggleBtn" class="action-button">
                        <i class="fa-solid fa-cog"></i> Settings
                    </button>
                    <button id="batchToggleBtn" class="action-button">
                        <i class="fa-solid fa-list-check"></i> Batch download
                    </button>
                    <button id="downloadSelectedBtn" class="action-button" style="display:none;">
                        <i class="fa-solid fa-download"></i> Download selected
                    </button>
                </div>
                <div id="settingsPanel" class="settings-panel" style="display: none;">
                    <h3>Settings</h3>
                    <div class="settings-options">
                        <div class="setting-item">
                            <label for="showNSFW">Show NSFW content</label>
                            <input type="checkbox" id="showNSFW" ${extension_settings.mlpchag.showNSFW ? 'checked' : ''}>
                        </div>
                        <div class="setting-item">
                            <label for="cacheEnabled">Enable caching</label>
                            <input type="checkbox" id="cacheEnabled" ${extension_settings.mlpchag.cacheEnabled ? 'checked' : ''}>
                        </div>
                        <div class="setting-item">
                            <label for="showTagCount">Show tag counts</label>
                            <input type="checkbox" id="showTagCount" ${extension_settings.mlpchag.showTagCount ? 'checked' : ''}>
                        </div>
                        <div class="setting-item">
                            <label for="findCountSelect">Characters per page</label>
                            <select id="findCountSelect">
                                <option value="10" ${extension_settings.mlpchag.findCount === 10 ? 'selected' : ''}>10</option>
                                <option value="20" ${extension_settings.mlpchag.findCount === 20 ? 'selected' : ''}>20</option>
                                <option value="30" ${extension_settings.mlpchag.findCount === 30 ? 'selected' : ''}>30</option>
                                <option value="50" ${extension_settings.mlpchag.findCount === 50 ? 'selected' : ''}>50</option>
                            </select>
                        </div>
                    </div>
                    <button id="clearCacheBtn" class="clear-cache-button">Clear Cache</button>
                </div>
                <div class="tags-container">
                    <div class="categories-row">
                        ${CATEGORIES.map(category => `
                            <button class="category-button"
                                data-tag="${category.id}"
                                style="--category-color: ${category.color}"
                                title="Click to include, Shift+Click or Right-click to exclude">
                                ${category.label} ${extension_settings.mlpchag.showTagCount ? `<span class="tag-count">(0)</span>` : ''}
                            </button>
                        `).join('')}
                    </div>
                    <div class="tags-divider">Types</div>
                    <div class="tags-row">
                        <!-- Tags will be dynamically inserted here -->
                    </div>
                    <div class="filter-help-text">
                        <small>Click to include • Shift+Click or Right-click to exclude</small>
                    </div>
                    <button class="clear-tags-button">Clear All Filters</button>
                </div>
            </div>
        </div>
        <div class="scrollable-content">
            <div class="character-list-popup">
                <div class="loading-spinner">
                    <div class="spinner"></div>
                    <p>Loading characters...</p>
                </div>
            </div>
        </div>
        <div class="search-footer">
            <div class="page-buttons">
                <button id="prevPageButton">
                    <i class="fa-solid fa-chevron-left"></i> Previous
                </button>
                <div class="page-input-container">
                    <input type="number" id="pageNumberInput" min="1" value="1">
                    <span class="page-separator">/</span>
                    <span id="totalPages">1</span>
                </div>
                <button id="nextPageButton">
                    Next <i class="fa-solid fa-chevron-right"></i>
                </button>
            </div>
            <div class="search-stats">
                <span id="resultCount">0</span> characters found
            </div>
        </div>
    </div>`;
}

async function initializeSearchAndNavigation() {
    refreshTagsDisplay();
    await loadSettings();

    try {
        await executeCharacterSearch({
            searchTerm: '',
            searchType: 'name',
            page: currentPage,
            forceReload: true
});
    } catch (error) {}

    const searchInput = document.getElementById('characterSearchInput');
    const searchTypeButton = document.getElementById('searchTypeButton');
    const searchTypeDropdown = document.getElementById('searchTypeDropdown');
    const currentSearchType = document.getElementById('currentSearchType');
    const sortSelect = document.getElementById('sortSelect');
    const prevButton = document.getElementById('prevPageButton');
    const nextButton = document.getElementById('nextPageButton');
    const pageNumberInput = document.getElementById('pageNumberInput');
    const randomCharacterBtn = document.getElementById('randomCharacterBtn');
    const settingsToggleBtn = document.getElementById('settingsToggleBtn');
    const batchToggleBtn = document.getElementById('batchToggleBtn');
    const downloadSelectedBtn = document.getElementById('downloadSelectedBtn');
    const settingsPanel = document.getElementById('settingsPanel');
    const resultCountSpan = document.getElementById('resultCount');

    const showNSFWCheckbox = document.getElementById('showNSFW');
    const cacheEnabledCheckbox = document.getElementById('cacheEnabled');
    const showTagCountCheckbox = document.getElementById('showTagCount');
    const findCountSelect = document.getElementById('findCountSelect');
    const clearCacheBtn = document.getElementById('clearCacheBtn');

    if (resultCountSpan && mlpcharacters) {
        resultCountSpan.textContent = mlpcharacters.length;
    }

    let currentSearchTypeValue = 'name';

    if (searchTypeButton && searchTypeDropdown) {
        searchTypeButton.addEventListener('click', (e) => {
            e.stopPropagation();
            const isVisible = searchTypeDropdown.style.display !== 'none';
            searchTypeDropdown.style.display = isVisible ? 'none' : 'block';
        });

        document.addEventListener('click', () => {
            searchTypeDropdown.style.display = 'none';
        });

        searchTypeDropdown.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        const dropdownOptions = searchTypeDropdown.querySelectorAll('.dropdown-option');

        dropdownOptions.forEach(option => {
            option.addEventListener('click', () => {
                const value = option.dataset.value;
                currentSearchTypeValue = value;
                currentSearchType.textContent = option.textContent;
                searchTypeDropdown.style.display = 'none';

                switch (value) {
                    case 'name':
                        searchInput.placeholder = "Search by character name...";
                        break;
                    case 'description':
                        searchInput.placeholder = "Search in descriptions...";
                        break;
                    case 'author':
                        searchInput.placeholder = "Search by author name...";
                        break;
                }

                currentPage = 1;
                if (pageNumberInput) pageNumberInput.value = currentPage;

                executeCharacterSearch({
                    searchTerm: searchInput.value,
                    searchType: value,
                    page: 1
                });
            });
        });
    }

    if (searchInput) {
        const handleSearch = debounce(() => {
            currentPage = 1;
            if (pageNumberInput) pageNumberInput.value = currentPage;
            executeCharacterSearch({
                searchTerm: searchInput.value,
                searchType: currentSearchTypeValue,
                page: currentPage
            });
        }, 300);

        searchInput.addEventListener('input', handleSearch);
    }

    if (sortSelect) {
        sortSelect.addEventListener('change', () => {
            executeCharacterSearch({
                searchTerm: searchInput?.value || '',
                searchType: currentSearchTypeValue,
                page: currentPage
            });
        });
    }

    if (prevButton) {
        prevButton.addEventListener('click', async () => {
            if (currentPage > 1) {
                currentPage--;
                await executeCharacterSearch({
                    searchTerm: searchInput?.value || '',
                    searchType: currentSearchTypeValue,
                    page: currentPage
                });
            }
        });
    }

    if (nextButton) {
        nextButton.addEventListener('click', async () => {
            currentPage++;
            await executeCharacterSearch({
                searchTerm: searchInput?.value || '',
                searchType: currentSearchTypeValue,
                page: currentPage
            });
        });
    }

    if (randomCharacterBtn) {
        randomCharacterBtn.addEventListener('click', () => {
            const randomChar = getRandomCharacter();
            if (randomChar) {
                const modal = createPreviewModal(randomChar);
                callPopup(modal, 'html');
                setupPreviewModalInteractions();
            } else {
                toastr.error('No characters available for random selection');
            }
        });
    }

    if (batchToggleBtn && downloadSelectedBtn) {
        batchToggleBtn.addEventListener('click', () => {
            batchMode = !batchMode;
            selectedPaths = [];
            downloadSelectedBtn.style.display = batchMode ? 'inline-flex' : 'none';
            updateCharacterListInView(mlpcharacters);
        });

        downloadSelectedBtn.addEventListener('click', async () => {
            for (const path of selectedPaths) {
                await downloadCharacter(path);
            }
        });
    }

    if (settingsToggleBtn && settingsPanel) {
        settingsToggleBtn.addEventListener('click', () => {
            const isVisible = settingsPanel.style.display !== 'none';
            settingsPanel.style.display = isVisible ? 'none' : 'block';
        });
    }

    if (showNSFWCheckbox) {
        showNSFWCheckbox.addEventListener('change', () => {
            extension_settings.mlpchag.showNSFW = showNSFWCheckbox.checked;
            executeCharacterSearch({
                searchTerm: searchInput?.value || '',
                searchType: currentSearchTypeValue,
                page: 1,
                forceReload: false
            });
        });
    }

    if (cacheEnabledCheckbox) {
        cacheEnabledCheckbox.addEventListener('change', () => {
            extension_settings.mlpchag.cacheEnabled = cacheEnabledCheckbox.checked;
        });
    }

    if (showTagCountCheckbox) {
        showTagCountCheckbox.addEventListener('change', () => {
            extension_settings.mlpchag.showTagCount = showTagCountCheckbox.checked;

            document.querySelectorAll('.tag-count').forEach(span => {
                span.style.display = showTagCountCheckbox.checked ? 'inline' : 'none';
            });
        });
    }

    if (findCountSelect) {
        findCountSelect.addEventListener('change', () => {
            extension_settings.mlpchag.findCount = parseInt(findCountSelect.value);
            resetPageAndSearch();
        });
    }

    if (clearCacheBtn) {
        clearCacheBtn.addEventListener('click', () => {
            cachedData = null;
            lastFetchTime = 0;
            toastr.success('Cache cleared successfully');
            resetPageAndSearch();
        });
    }

    if (pageNumberInput) {
        pageNumberInput.addEventListener('change', async () => {
            let newPage = parseInt(pageNumberInput.value);
            if (isNaN(newPage) || newPage < 1) {
                newPage = 1;
                pageNumberInput.value = 1;
            } else if (newPage > totalPages) {
                newPage = totalPages;
                pageNumberInput.value = totalPages;
            }

            currentPage = newPage;

            await executeCharacterSearch({
                searchTerm: searchInput?.value || '',
                searchType: currentSearchTypeValue,
                page: currentPage
            });
        });

        pageNumberInput.addEventListener('keypress', async (e) => {
            if (e.key === 'Enter') {
                let newPage = parseInt(pageNumberInput.value);
                if (isNaN(newPage) || newPage < 1) {
                    newPage = 1;
                    pageNumberInput.value = 1;
                } else if (newPage > totalPages) {
                    newPage = totalPages;
                    pageNumberInput.value = totalPages;
                }

                currentPage = newPage;

                await executeCharacterSearch({
                    searchTerm: searchInput?.value || '',
                    searchType: currentSearchTypeValue,
                    page: currentPage
                });
            }
        });
    }
}

function openSearchPopup() {
    batchMode = false;
    selectedPaths = [];
    selectedTags = [];
    excludedTags = [];
    cachedData = null;
    lastFetchTime = 0;

    loadSettings().then(() => {
        displayCharactersInListViewPopup();
    });
}

function getRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

function addCustomTag(tagName) {
    if (!tagName || tagName.trim() === '') return false;

    tagName = tagName.trim();

    if (TAGS.some(tag => tag.id.toLowerCase() === tagName.toLowerCase())) {
        toastr.warning('This tag already exists in the predefined tags');
        return false;
    }

    if (extension_settings.mlpchag.customTags.some(tag => tag.id.toLowerCase() === tagName.toLowerCase())) {
        toastr.warning('This tag already exists in your custom tags');
        return false;
    }

    const newTag = {
        id: tagName,
        label: tagName,
        color: getRandomColor(),
        selected: false
    };

    extension_settings.mlpchag.customTags.push(newTag);

    refreshTagsDisplay();

    toastr.success(`Added custom tag: ${tagName}`);
    return true;
}

function removeCustomTag(tagId) {
    const initialLength = extension_settings.mlpchag.customTags.length;
    extension_settings.mlpchag.customTags = extension_settings.mlpchag.customTags.filter(tag => tag.id !== tagId);

    if (initialLength !== extension_settings.mlpchag.customTags.length) {
        selectedTags = selectedTags.filter(tag => tag !== tagId);
        refreshTagsDisplay();
        toastr.success(`Removed custom tag: ${tagId}`);
        return true;
    }

    return false;
}

function refreshTagsDisplay() {
    const tagsRow = document.querySelector('.tags-row');
    if (!tagsRow) return;

    tagsRow.innerHTML = '';

    TAGS.forEach(tag => {
        const isSelected = selectedTags.includes(tag.id);
        const isExcluded = excludedTags.includes(tag.id);
        tagsRow.innerHTML += `
            <button class="tag-button ${isSelected ? 'selected' : ''} ${isExcluded ? 'excluded' : ''}"
                data-tag="${tag.id}"
                style="--tag-color: ${tag.color}"
                title="Click to include, Shift+Click or Right-click to exclude">
                ${tag.label} ${extension_settings.mlpchag.showTagCount ? `<span class="tag-count">(${tagCounts[tag.id] || 0})</span>` : ''}
            </button>
        `;
    });

    extension_settings.mlpchag.customTags.forEach(tag => {
        const isSelected = selectedTags.includes(tag.id);
        const isExcluded = excludedTags.includes(tag.id);
        tagsRow.innerHTML += `
            <button class="tag-button custom-tag ${isSelected ? 'selected' : ''} ${isExcluded ? 'excluded' : ''}"
                data-tag="${tag.id}"
                style="--tag-color: ${tag.color}"
                title="Click to include, Shift+Click or Right-click to exclude">
                ${tag.label} ${extension_settings.mlpchag.showTagCount ? `<span class="tag-count">(${tagCounts[tag.id] || 0})</span>` : ''}
                <span class="remove-tag" data-tag-id="${tag.id}">×</span>
            </button>
        `;
    });

    tagsRow.innerHTML += `
        <div class="add-tag-container">
            <input type="text" id="newTagInput" placeholder="Add tag...">
            <button id="addTagButton">+</button>
        </div>
    `;

    setupTagHandlers();
}

jQuery(async () => {
    $('#external_import_button').after(`
        <button id="search-mlpchag" class="menu_button" title="Search anchor">
            <i class="fas fa-anchor"></i>
        </button>
    `);

    $('#search-mlpchag').on('click', openSearchPopup);

    await loadSettings();
});
