import { getMonsters } from "https://monstyrslayr.github.io/msmTools/monsters.js";

const NEXT_MONSTER_TIMER = 5000;
const NEXT_MONSTER_INTERVAL = 20;
let autoNextMonsterInterval = null;

const monsters = await getMonsters();

function normalizeAndTrim(str)
{
    return str
        .normalize("NFD")                  // decompose accented characters
        .replace(/[\u0300-\u036f]/g, "")   // remove diacritical marks
        .replace(/[^a-z0-9]/gi, "")        // remove non alphanumeric characters
        .toLowerCase();                    // take a wild guess
}

function setupAutocomplete(input, list, allMonsters, onSelect)
{
    let currentMatches = [];

    input.addEventListener("input", () =>
    {
        const query = normalizeAndTrim(input.value);
        // list.innerHTML = "";

        if (!query) return;

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
                // list.innerHTML = "";
                onSelect(monster);
            });

            // list.appendChild(item);

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

    // input.addEventListener("keydown", (e) =>
    // {
    //     if (e.key === "Enter" && currentMatches.length > 0)
    //     {
    //         e.preventDefault();

    //         // simulate click on first match
    //         const firstItem = list.querySelector(".autocompleteItem");
    //         if (firstItem) firstItem.click();
    //     }
    // });

    // document.addEventListener("click", (e) =>
    // {
    //     if (!list.contains(e.target) && e.target !== input)
    //     {
    //         list.innerHTML = "";
    //     }
    // });
}

let curMonster = null;

const cluesDiv = document.getElementById("clues");
const guessDiv = document.getElementById("guess");
const revealDiv = document.getElementById("reveal");
const guessInput = document.getElementById("guessInput");
const guessAutocomplete = document.getElementById("guessAutocomplete");

setupAutocomplete(guessInput, guessAutocomplete, monsters, (guessedMonster) => {
    if (guessedMonster == curMonster)
    {
        revealMonster(false);
    }
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
    cluesDiv.innerHTML = "";
    revealDiv.innerHTML = "";
    guessInput.value = "";
    clearInterval(autoNextMonsterInterval);

    curMonster = monsters[Math.floor(monsters.length * Math.random())];

    const clueImg = document.createElement("img");
    clueImg.src = curMonster.portraitBlack;
    cluesDiv.appendChild(clueImg);

    guessInput.disabled = false;
}

function revealMonster(forfeit)
{
    const startTime = new Date();
    const endTime = new Date();
    endTime.setMilliseconds(endTime.getMilliseconds() + NEXT_MONSTER_TIMER);

    guessInput.disabled = true;

    const revealImg = document.createElement("img");
    revealImg.src = curMonster.portrait;
    revealDiv.appendChild(revealImg);

    const sweepingCircle = document.createElement("canvas");
    sweepingCircle.classList.add("sweepingCircle");
    revealDiv.appendChild(sweepingCircle);
    const sweepingCircleCtx = sweepingCircle.getContext("2d");

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
        sweepingCircleCtx.strokeStyle = "black";
        sweepingCircleCtx.lineWidth = 16;
        sweepingCircleCtx.stroke();

        const now = new Date();
        t = now - startTime;

        if (now > endTime)
        {
            newGuess();
        }
    }, NEXT_MONSTER_INTERVAL);
}

newGuess();
