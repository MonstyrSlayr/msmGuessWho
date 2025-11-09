import { getMonsters, getRarities } from "https://monstyrslayr.github.io/msmTools/monsters.js";
import { getCookie, setCookie } from "./cookies.js";

const NEXT_MONSTER_TIMER = 5000;
const NEXT_MONSTER_INTERVAL = 20;
let autoNextMonsterInterval = null;
let timerInterval = null;

let points = 0;

let guessStartTime = null;

const RARITY = getRarities();

function getMonstersWithUniqueIslands(monsters)
{
    const serializeIslands = (islands) =>
    {
        return [...islands]
            .filter(island => !island.unreleased)
            .map(island => island.codename)
            .sort()
            .join("|");
    };

    const comboCount = {};
    for (const monster of monsters)
    {
        const key = serializeIslands(monster.islands);
        comboCount[key] = (comboCount[key] || 0) + 1;
    }

    return monsters.filter(monster => comboCount[serializeIslands(monster.islands)] === 1);
}

function getMonstersWithUniqueElements(monsters)
{
    const serializeElements = (elements) =>
    {
        return [...elements]
            .map(elementSigil => elementSigil.name)
            .sort()
            .join("|");
    };

    const comboCount = {};
    for (const monster of monsters)
    {
        const key = serializeElements(monster.elements);
        comboCount[key] = (comboCount[key] || 0) + 1;
    }

    return monsters.filter(monster => comboCount[serializeElements(monster.elements)] === 1);
}

function getMonstersWithUniqueBios(monsters)
{
    const bioCount = {};
    for (const monster of monsters)
    {
        const bio = normalizeBio(monster.bio);
        bioCount[bio] = (bioCount[bio] || 0) + 1;
    }

    return monsters.filter(monster => bioCount[normalizeBio(monster.bio)] === 1);
}

function normalizeBio(bio)
{
    return bio
        .trim()
        .replace(/\s+/g, " ") // collapse multiple spaces/newlines
        .toLowerCase();       // make comparison case-insensitive
}

// const monsters = (await getMonsters()).filter((monster) => monster.name == "Quibble");
const monsters = await getMonsters();
const commonMonsters = monsters.filter(monster => monster.rarity == RARITY.COMMON);
const rareMonsters = monsters.filter(monster => monster.rarity == RARITY.RARE);
const epicMonsters = monsters.filter(monster => monster.rarity == RARITY.EPIC);
const majorMonsters = monsters.filter(monster => monster.rarity == RARITY.MAJOR);
const minorMonsters = monsters.filter(monster => monster.rarity == RARITY.MINOR);

const commonMonstersUniqueIslands = getMonstersWithUniqueIslands(commonMonsters);
const rareMonstersUniqueIslands = getMonstersWithUniqueIslands(rareMonsters);
const epicMonstersUniqueIslands = getMonstersWithUniqueIslands(epicMonsters);
const majorMonstersUniqueIslands = getMonstersWithUniqueIslands(majorMonsters);
const minorMonstersUniqueIslands = getMonstersWithUniqueIslands(minorMonsters);

const commonMonstersUniqueElements = getMonstersWithUniqueElements(commonMonsters);
const rareMonstersUniqueElements = getMonstersWithUniqueElements(rareMonsters);
const epicMonstersUniqueElements = getMonstersWithUniqueElements(epicMonsters);
const majorMonstersUniqueElements = getMonstersWithUniqueElements(majorMonsters);
const minorMonstersUniqueElements = getMonstersWithUniqueElements(minorMonsters);

const monsterUniqueBios = getMonstersWithUniqueBios(monsters);

function normalizeAndTrim(str)
{
    return str
        .normalize("NFD")                  // decompose accented characters
        .replace(/[\u0300-\u036f]/g, "")   // remove diacritical marks
        .replace(/[^a-z0-9]/gi, "")        // remove non alphanumeric characters
        .toLowerCase();                    // take a wild guess
}

function setupAutocomplete(input, ewDisclaimer, allMonsters, onSelect)
{
    let currentMatches = [];

    input.addEventListener("input", () =>
    {
        const query = normalizeAndTrim(input.value);
        // list.innerHTML = "";

        if (!query) return;

        if (query == "epicwubbox")
        {
            ewDisclaimer.style.display = "block";
        }
        else
        {
            ewDisclaimer.style.display = "none";
        }

        let foundMonster = false;

        currentMatches = allMonsters.filter(m => normalizeAndTrim(m.name).includes(query));

        for (const monster of currentMatches)
        {
            const item = document.createElement("div");
            item.className = "autocompleteItem";

            const img = document.createElement("img");
            img.src = monster.square;
            img.alt = monster.name;

            const text = document.createElement("span");
            text.textContent = monster.name;

            item.appendChild(img);
            item.appendChild(text);

            item.addEventListener("click", () =>
            {
                input.value = monster.name;
                onSelect(monster);
            });

            if (query == normalizeAndTrim(monster.name))
            {
                onSelect(monster);
                foundMonster = true;
            }
        }

        if (!foundMonster)
        {
            onSelect(null);
        }
    });
}

function formatTime(ms)
{
    const totalMilliseconds = Math.floor(ms);
    const totalSeconds = Math.floor(totalMilliseconds / 1000);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const milliseconds = totalMilliseconds % 1000;

    // Pad with leading zeros
    const pad = (n, len = 2) => String(n).padStart(len, '0');
    return `${pad(minutes)}:${pad(seconds)}:${pad(milliseconds, 3)}`;
}

function censorMonsterWords(text, monsterName)
{
    const words = monsterName.trim().split(/\s+/);

    const pattern = words
        .map(w => `${escapeRegex(w)}s?`)
        .join("|");

    const regex = new RegExp(`(?<!\\w)(${pattern})(?=[\\W_]|$)`, "gi");

    return text.replace(regex, "???");
}

function escapeRegex(str)
{
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

let curMonster = null;
let isFirstGuess = true;

const pointsSpan = document.getElementById("pointsSpan");
const timerSpan = document.getElementById("timer");
const cluesDiv = document.getElementById("clues");
const cluesBoxDiv = document.getElementById("cluesBox");
const cluesFooter = document.getElementById("cluesFooter");
const guessDiv = document.getElementById("guess");
const revealDiv = document.getElementById("reveal");
const forfeitButton = document.getElementById("forfeitButton");
const guessInput = document.getElementById("guessInput");
const epicWubboxDisclaimer = document.getElementById("epicWubboxDisclaimer");

setupAutocomplete(guessInput, epicWubboxDisclaimer, monsters, (guessedMonster) => {
    if (guessedMonster == curMonster)
    {
        revealMonster(false);
    }
});

forfeitButton.addEventListener("click", () =>
{
    revealMonster(true);
});

document.addEventListener("keydown", (e) =>
{
    if (guessInput.disabled)
    {
        if (e.key === "Enter")
        {
            newGuess();
        }
    }
    else
    {
        const isTypingInTextbox = document.activeElement === guessInput;

        // Ignore keys like Shift, Control, etc.
        if (e.key.length === 1 && !isTypingInTextbox)
        {
            e.preventDefault(); // prevent accidental scrolling or default behavior
            guessInput.focus();

            // Append the typed character
            const val = guessInput.value;
            const start = guessInput.selectionStart;
            const end = guessInput.selectionEnd;

            guessInput.value = val.slice(0, start) + e.key + val.slice(end);
            
            // Move the cursor after the inserted character
            guessInput.setSelectionRange(start + 1, start + 1);
        }
    }
});

function newGuess()
{
    cluesBoxDiv.innerHTML = "";
    cluesFooter.innerHTML = "";
    revealDiv.innerHTML = "";
    guessInput.value = "";
    clearInterval(autoNextMonsterInterval);

    curMonster = monsters[Math.floor(monsters.length * Math.random())];
    const availableModes = ["silhouette"];

    if ([...curMonster.likes].filter(like => !like.island.unreleased).length > 0)
    {
        availableModes.push("likes");
    }

    if (!isFirstGuess)
    {
        availableModes.push("memory");
    }

    if (commonMonstersUniqueIslands.includes(curMonster)
    || rareMonstersUniqueIslands.includes(curMonster)
    || epicMonstersUniqueIslands.includes(curMonster)
    || majorMonstersUniqueIslands.includes(curMonster)
    || minorMonstersUniqueIslands.includes(curMonster)) availableModes.push("islands");

    if (commonMonstersUniqueElements.includes(curMonster)
    || rareMonstersUniqueElements.includes(curMonster)
    || epicMonstersUniqueElements.includes(curMonster)
    || majorMonstersUniqueElements.includes(curMonster)
    || minorMonstersUniqueElements.includes(curMonster)) availableModes.push("elements");

    if (monsterUniqueBios.includes(curMonster)) availableModes.push("bio");
    // console.log(availableModes);

    const mode = availableModes[Math.floor(availableModes.length * Math.random())];

    switch (mode)
    {
        case "silhouette": default:
            const clueImg = document.createElement("img");
            clueImg.src = curMonster.portraitBlack;
            clueImg.alt = "Silhouette";
            cluesBoxDiv.appendChild(clueImg);

            cluesFooter.textContent = "";

            break;
        
        case "islands":
            for (const island of curMonster.islands)
            {
                const clueImg = document.createElement("img");
                clueImg.src = island.symbol;
                clueImg.alt = island.name;
                cluesBoxDiv.appendChild(clueImg);
            }

            if (curMonster.islands.size == 1)
            {
                cluesFooter.textContent = `Only one ${curMonster.rarity} monster is uniquely on this island!`;
            }
            else
            {
                cluesFooter.textContent = `Only one ${curMonster.rarity} monster is uniquely on these islands!`;
            }

            break;
        
        case "elements":
            for (const elementSigil of curMonster.elements)
            {
                const clueImg = document.createElement("img");
                clueImg.src = elementSigil.sigil;
                clueImg.alt = elementSigil.name;
                cluesBoxDiv.appendChild(clueImg);
            }

            cluesFooter.textContent = `Only one ${curMonster.rarity} monster has this unique element combination!`;

            break;
        
        case "memory":
            const clueSound = document.createElement("audio");
            clueSound.controls = true;
            clueSound.autoplay = true;
            cluesBoxDiv.appendChild(clueSound);

                const clueSrc = document.createElement("source");
                clueSrc.src = curMonster.memory;
                clueSound.appendChild(clueSrc);

            const daRarity = curMonster.rarity == RARITY.CHILD ? "Young" : curMonster.rarity;

            cluesFooter.textContent = `The rarity is ${daRarity}!`;
        
            break;

        case "likes":
            const randLike = [...curMonster.likes].filter(like => !like.island.unreleased)[Math.floor([...curMonster.likes].filter(like => !like.island.unreleased).length * Math.random())];

            const daIsland = randLike.island;
            const clueIsland = document.createElement("img");
            clueIsland.src = daIsland.symbol;
            clueIsland.alt = daIsland.name;
            cluesBoxDiv.appendChild(clueIsland);

            cluesFooter.innerHTML = `Likes:<br>`;

            const daLikes = [...curMonster.likes].filter(like => like.island == daIsland);

            for (const like of daLikes)
            {
                cluesFooter.innerHTML += like.name + "<br>";
            }

            break;
        
        case "bio":
            cluesFooter.textContent = censorMonsterWords(curMonster.bio, curMonster.name);

            break;
    }

    guessInput.disabled = false;
    forfeitButton.disabled = false;
    guessStartTime = new Date();

    timerInterval = setInterval(() =>
    {
        timerSpan.textContent = formatTime(new Date() - guessStartTime);
    }, 13);
}

function revealMonster(forfeit)
{
    isFirstGuess = false;

    const startTime = new Date();
    const endTime = new Date();
    endTime.setMilliseconds(endTime.getMilliseconds() + NEXT_MONSTER_TIMER);

    clearInterval(timerInterval);
    const elapsed = startTime - guessStartTime;

    guessInput.disabled = true;
    forfeitButton.disabled = true;

    const sweepingCircle = document.createElement("canvas");
    sweepingCircle.classList.add("sweepingCircle");
    revealDiv.appendChild(sweepingCircle);
    const sweepingCircleCtx = sweepingCircle.getContext("2d");

    const revealImg = document.createElement("img");
    revealImg.src = curMonster.portrait;
    revealImg.alt = curMonster.name;
    revealDiv.appendChild(revealImg);

    const revealText = document.createElement("p");
    if (forfeit)
    {
        revealText.textContent = `It was ${curMonster.name}!`;
    }
    else
    {
        revealText.textContent = `You guessed ${curMonster.name}!`;
        points++;

        let existed = true;
        if (getCookie(curMonster.name) == null)
        {
            setCookie(curMonster.name, elapsed, 364);
            existed = false;
        }

        const oldBest = parseInt(getCookie(curMonster.name));
        const bestTime = document.createElement("p");
        if (elapsed < oldBest || existed == false)
        {
            // you got a new best!!
            setCookie(curMonster.name, elapsed, 364);

            bestTime.textContent = `New Best Time for this monster: ${formatTime(elapsed)}`;
        }
        else
        {
            bestTime.textContent = `Best Time for this monster: ${formatTime(oldBest)}`;
        }

        revealDiv.append(bestTime);
    }
    revealDiv.appendChild(revealText);

    sweepingCircle.addEventListener("click", () =>
    {
        newGuess();
    });

    let t = 0;

    autoNextMonsterInterval = setInterval(() =>
    {
        let _angleOffset = -0.5 * Math.PI;
        let _angle = (t / NEXT_MONSTER_TIMER) * 2 * Math.PI;
        
        sweepingCircleCtx.beginPath();
        sweepingCircleCtx.arc(sweepingCircle.width/2, sweepingCircle.height/2, sweepingCircle.width/6, _angleOffset, _angleOffset + _angle);
        sweepingCircleCtx.strokeStyle = "white";
        sweepingCircleCtx.lineWidth = 16;
        sweepingCircleCtx.stroke();

        const now = new Date();
        t = now - startTime;

        if (now > endTime)
        {
            newGuess();
        }
    }, NEXT_MONSTER_INTERVAL);

    pointsSpan.textContent = points;
}

newGuess();
