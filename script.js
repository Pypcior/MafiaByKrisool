
    // =========================================
    // WERSJA GRY
    // =========================================
    // Zwiększaj przy każdej zmianie. Wersja pliku script.js jest
    // wyświetlana w rogu ekranu głównego obok wersji index.html -
    // jeśli obie się różnią (lub brakuje którejś), to przeglądarka
    // albo git nie podmienił któregoś z plików.

    const APP_VERSION = "1.8.0";

    // =========================================
    // DOSTĘPNE ROLE
    // =========================================
    // POPRAWKA: role dostępne zależą teraz od wybranego trybu gry
    // (podstawowy / zaawansowany). "roles" zostało zastąpione przez
    // getActiveRoles() - patrz sekcja TRYB GRY poniżej.

    const BASIC_ROLES = [
        "Szaman",
        "Mafia",
        "Błazen",
        "Medyk",
        "Rozjemca",
        "Wieśniak",
        "Alkoholik",
        "Informator"
    ];

    // Role dostępne DODATKOWO w trybie zaawansowanym. Wszystkie mają
    // zaimplementowaną akcję nocną lub specjalne zasady. Do warunków
    // zwycięstwa liczą się przez GOOD_ROLES / EVIL_ROLES poniżej
    // (Błazen i Szarlatanka są neutralni i nie liczą się do żadnej z
    // drużyn - nie ma ich ani w GOOD_ROLES, ani w EVIL_ROLES).

    const ADVANCED_ONLY_ROLES = [
        "Obserwator",
        "Guślarz",
        "Wieszcz",
        "Fałszerz",
        "Szarlatanka"
    ];

    // Role "dobre" (Miasto) - używane przy sprawdzeniu Szamana
    // oraz przy ustalaniu warunków zwycięstwa.
    const GOOD_ROLES = [
        "Szaman",
        "Medyk",
        "Rozjemca",
        "Wieśniak",
        "Alkoholik",
        "Obserwator",
        "Guślarz",
        "Wieszcz"
    ];

    // Role "złe" / drużyna zabijająca.
    const EVIL_ROLES = [
        "Mafia",
        "Informator",
        "Fałszerz"
    ];


    // =========================================
    // TRYB GRY (podstawowy / zaawansowany)
    // =========================================
    // NOWOŚĆ: przełącznik w menu głównym decyduje, jakie role są
    // dostępne przy przypisywaniu ról graczom.

    let gameMode = "basic";

    function setGameMode(mode) {

        gameMode = mode;

        document.getElementById(
            "modeBasicBtn"
        ).classList.toggle("active", mode === "basic");

        document.getElementById(
            "modeAdvancedBtn"
        ).classList.toggle("active", mode === "advanced");

    }

    function getActiveRoles() {

        if (gameMode === "advanced") {

            return BASIC_ROLES.concat(ADVANCED_ONLY_ROLES);

        }

        return BASIC_ROLES;

    }


    // =========================================
    // TABLICA GRACZY
    // =========================================

    let players = [];

    // =========================================
    // STAN GRY
    // =========================================
    // POPRAWKA: usunięto zduplikowany klucz "deathReason"
    // (występował dwukrotnie w tym samym obiekcie i nie był
    // nigdzie faktycznie używany na poziomie gry - każdy gracz
    // ma własne pole deathReason).

    let game = {

        day: 1,

        night: 0,

        phase: "day",

        dayStartedAt: null,
        dayTimerInterval: null,

        // Ile głosowań (wejść na szubienicę) zostało w tym dniu
        votingsLeft: 2,

        previousAlcoholicTarget: null,

        // NOWOŚĆ: analogicznie do Alkoholika - Fałszerz nie może
        // wrobić tej samej osoby dwa razy pod rząd.
        previousFalszerzTarget: null,

        currentNight: {

            alcoholic: null,
            alcoholicBlocked: null,

            medic: null,

            falszerz: null, // id wrobionej osoby (odwrócona frakcja tej nocy)

            shaman: null,

            wieszcz: null,    // [id1, id2] - para sprawdzana przez Wieszcza

            mafia: null,

            informator: null,

            obserwator: null, // id celu obserwowanego przez Obserwatora

            // NOWOŚĆ: mapa odwiedzin tej nocy - klucz: id odwiedzonego,
            // wartość: tablica id odwiedzających. Wypełniana przez każdą
            // rolę, która "odwiedza" kogoś w nocy (Medyk, Szaman, Mafia,
            // Informator, Wieszcz, Fałszerz). Używana przez Obserwatora.
            visits: {},

            log: []

        },

        // NOWOŚĆ: historia odwiedzin Guślarza przez całą rozgrywkę.
        // Klucz: id Guślarza (zawsze jeden), wartość: tablica obiektów
        // { night, visitorId, visitorName, visitorRole }.
        // Zapisywana niezależnie od nocy, odczytywana po śmierci Guślarza.
        guslarVisits: [],

        history: []

    };

    // =========================================
    // LOG NOCY - POMOCNICZA FUNKCJA
    // =========================================
    // POPRAWKA: nowa funkcja - zapisuje zdarzenie do dziennika
    // bieżącej nocy zamiast pokazywać alert od razu.

    function logNightEvent(message) {

        game.currentNight.log.push(message);

    }

    // =========================================
    // SYSTEM ODWIEDZIN
    // =========================================
    // NOWOŚĆ: każda rola "odwiedzająca" kogoś w nocy (Medyk, Szaman,
    // Mafia, Informator, Wieszcz) rejestruje odwiedziny przez tę
    // funkcję. Obserwator odczytuje zebrane odwiedziny na końcu nocy.
    // Odwiedziny Guślarza są dodatkowo zapisywane do trwałego rejestru
    // game.guslarVisits (nie kasowanego między nocami).

    function registerVisit(visitorId, targetId) {

        const visits = game.currentNight.visits;

        if (!visits[targetId]) {
            visits[targetId] = [];
        }

        if (!visits[targetId].includes(visitorId)) {
            visits[targetId].push(visitorId);
        }

        // Jeśli odwiedzony to Guślarz — dopisz do trwałego rejestru

        const guslar =
            players.find(p => p.role === "Guślarz");

        if (guslar && targetId === guslar.id) {

            const visitor =
                players.find(p => p.id === visitorId);

            if (visitor) {

                game.guslarVisits.push({
                    night: game.night,
                    visitorId: visitor.id,
                    visitorName: visitor.name,
                    visitorRole: visitor.role
                });

            }

        }

    }

    // =========================================
    // INFORMACJA O POSIADACZU ROLI
    // =========================================
    // POPRAWKA: nowa funkcja pomocnicza - zwraca gracza mającego
    // daną rolę niezależnie od tego, czy żyje czy nie. Używana do
    // wyświetlania "kto jest daną rolą i czy żyje" na każdym
    // panelu akcji nocnej.

    function getRoleHolder(roleName) {

        return players.find(player => player.role === roleName);

    }

    // NOWOŚĆ: nazwa roli do wyświetlenia - Szarlatanka, która straciła
    // Błazna, jest pokazywana jako "Rozpaczona Szarlatanka" (rola w
    // logice gry nadal brzmi "Szarlatanka").
    function getRoleLabel(player) {

        if (player.role === "Szarlatanka" && player.despaired) {
            return "Rozpaczona Szarlatanka";
        }

        return player.role;

    }

    function describeRoleHolder(icon, roleName) {

        const holder = getRoleHolder(roleName);

        if (!holder) {

            return icon + " Rola „" + roleName + "” nie występuje w tej rozgrywce.";

        }

        const status = holder.alive ? "żyje" : "nie żyje";

        return icon + " " + getRoleLabel(holder) + ": " + holder.name + " (" + status + ")";

    }

    // =========================================
    // MUZYKA NOCNA
    // =========================================
    // Muzyka gra w tle przez całą noc i wyłącza się, gdy nastaje dzień.
    // Źródło dźwięku to element <audio id="nightMusic" src="..."> w
    // index.html - żeby zmienić utwór, wystarczy podmienić "src" tam
    // (albo wrzucić swój plik jako night.mp3 do folderu "sfx").
    // Muzyka startuje w startNight() i gra przez całą noc - także
    // podczas podsumowania nocy (okna alert). Wyłącza się dopiero, gdy
    // nastaje dzień (showDay()), oraz w showGameOver() / goBack().
    //
    // Osobny dźwięk początku dnia (pianie koguta) to element
    // <audio id="dayStartSound" src="..."> - gra raz, zaraz po
    // podsumowaniu nocy, gdy zaczyna się nowy dzień.

    const nightAudio = document.getElementById("nightMusic");

    const dayStartAudio = document.getElementById("dayStartSound");

    let musicEnabled = true;
    let musicVolume = 0.5;

    try {

        if (localStorage.getItem("mafiaMusicEnabled") === "0") {
            musicEnabled = false;
        }

        const savedVolume =
            parseFloat(localStorage.getItem("mafiaMusicVolume"));

        if (!Number.isNaN(savedVolume)) {
            musicVolume = Math.min(1, Math.max(0, savedVolume));
        }

    } catch (e) {
        // localStorage niedostępny - zostają wartości domyślne
    }

    // Odtwarza efekt dźwiękowy z elementu <audio id="..."> w index.html.
    // Brak elementu lub brak pliku w "src" = po prostu cisza (w konsoli
    // pojawia się tylko ostrzeżenie). Efekty respektują przycisk
    // wyciszenia oraz suwak głośności.

    function playSfx(elementId) {

        if (!musicEnabled) return;

        const el = document.getElementById(elementId);

        if (!el) return;

        el.currentTime = 0;

        el.volume = musicVolume;

        const playPromise = el.play();

        if (playPromise && playPromise.catch) {

            playPromise.catch(function (err) {

                console.warn(
                    "Nie udało się odtworzyć dźwięku #" + elementId +
                    " (sprawdź czy plik z atrybutu src istnieje):",
                    err
                );

            });

        }

    }

    // Komunikat w stylu alert(), ale NIE blokujący strony: to zwykłe
    // okienko HTML (#sfxModal). Natywny alert() zamraża całą stronę, a
    // przeglądarka potrzebuje wtedy głównego wątku, żeby dociągać dane
    // dźwięku - efekt grał więc ok. pół sekundy i milkł do zamknięcia
    // okna. Przy własnym okienku dźwięk gra normalnie od początku do
    // końca. Zwraca Promise, który kończy się po kliknięciu "OK".

    function showModalAlert(message) {

        return new Promise(function (resolve) {

            const modal = document.getElementById("sfxModal");

            const text = document.getElementById("sfxModalText");

            const ok = document.getElementById("sfxModalOk");

            // Awaryjnie, gdy okienka nie ma w HTML - zwykły alert()

            if (!modal || !text || !ok) {

                alert(message);

                resolve();

                return;

            }

            text.textContent = message;

            modal.classList.add("open");

            let closed = false;

            const close = function () {

                if (closed) return;

                closed = true;

                modal.classList.remove("open");

                ok.removeEventListener("click", close);

                document.removeEventListener("keydown", onKey);

                resolve();

            };

            const onKey = function (e) {

                if (
                    e.key === "Enter" ||
                    e.key === "Escape" ||
                    e.key === " "
                ) {

                    e.preventDefault();

                    close();

                }

            };

            ok.addEventListener("click", close);

            document.addEventListener("keydown", onKey);

            ok.focus();

        });

    }

    // Pokazuje komunikat z dźwiękiem, który gra W TRAKCIE komunikatu.
    // Użycie: await alertWithSfx("idDzwieku", "treść");
    // (bez await kod idzie dalej od razu, a okienko i tak się pokaże).

    async function alertWithSfx(elementId, message) {

        playSfx(elementId);

        await showModalAlert(message);

    }

    function playDayStartSound() {

        playSfx("dayStartSound");

    }

    function startNightMusic() {

        // Gdyby kogut jeszcze pianiał, gdy zaczyna się kolejna noc
        if (dayStartAudio) {
            dayStartAudio.pause();
            dayStartAudio.currentTime = 0;
        }

        if (!nightAudio || !musicEnabled) return;

        nightAudio.currentTime = 0;

        nightAudio.volume = musicVolume;

        const playPromise = nightAudio.play();

        if (playPromise && playPromise.catch) {

            playPromise.catch(function (err) {

                console.warn(
                    "Nie udało się odtworzyć muzyki nocnej " +
                    "(sprawdź czy plik z atrybutu src istnieje):",
                    err
                );

            });

        }

    }

    function stopNightMusic() {

        if (!nightAudio) return;

        nightAudio.pause();

        nightAudio.currentTime = 0;

    }

    function setMusicVolume(value) {

        musicVolume = Math.min(1, Math.max(0, value));

        if (nightAudio) {
            nightAudio.volume = musicVolume;
        }

        if (dayStartAudio) {
            dayStartAudio.volume = musicVolume;
        }

        try {
            localStorage.setItem("mafiaMusicVolume", String(musicVolume));
        } catch (e) { }

    }

    function toggleMusic() {

        musicEnabled = !musicEnabled;

        try {
            localStorage.setItem(
                "mafiaMusicEnabled",
                musicEnabled ? "1" : "0"
            );
        } catch (e) { }

        updateMusicToggleButton();

        if (!musicEnabled) {

            stopNightMusic();

        } else if (game.phase === "night") {

            // Włączenie w trakcie nocy - muzyka od razu wchodzi

            startNightMusic();

        }

    }

    function updateMusicToggleButton() {

        const button = document.getElementById("musicToggle");

        if (!button) return;

        button.textContent = musicEnabled ? "🔊" : "🔇";

        button.title =
            musicEnabled
                ? "Dźwięk (muzyka nocna i kogut): włączony"
                : "Dźwięk (muzyka nocna i kogut): wyłączony";

    }

    (function initMusicControls() {

        const toggle = document.getElementById("musicToggle");

        const slider = document.getElementById("musicVolume");

        if (nightAudio) {
            nightAudio.volume = musicVolume;
        }

        if (toggle) {
            toggle.addEventListener("click", toggleMusic);
        }

        if (slider) {

            slider.value = Math.round(musicVolume * 100);

            slider.addEventListener("input", function () {
                setMusicVolume(parseInt(this.value) / 100);
            });

        }

        updateMusicToggleButton();

    })();


    // =========================================
    // SZUBIENICA - ZASADY
    // =========================================
    // Maksymalna liczba osądzeń (wejść na szubienicę) w jednym dniu.
    const MAX_DAY_VOTINGS = 2;

    // Tabela: żywych -> potrzebnych głosów do wstawienia na szubienicę.
    const VOTES_NEEDED_TABLE = {
        15: 7, 14: 6, 13: 6, 12: 5, 11: 5, 10: 4, 9: 4,
        8: 3, 7: 3, 6: 2, 5: 2, 4: 2, 3: 1, 2: 1
    };

    function getVotesNeeded(aliveCount) {

        if (aliveCount < 1) return 0;

        if (aliveCount <= 2) return 1;

        if (VOTES_NEEDED_TABLE[aliveCount] !== undefined) {
            return VOTES_NEEDED_TABLE[aliveCount];
        }

        // Powyżej tabeli (16+ żywych): ta sama zasada co w jej górnej części
        return Math.floor((aliveCount - 1) / 2);

    }

    // Id gracza aktualnie stojącego na szubienicy
    let gallowsTargetId = null;

    function updateDayVotingInfo() {

        const leftEl = document.getElementById("dayVotingsLeft");
        const neededEl = document.getElementById("dayVotesNeeded");
        const btn = document.getElementById("startVotingBtn");

        if (!leftEl || !neededEl) return;

        const alive = players.filter(p => p.alive).length;
        const needed = getVotesNeeded(alive);
        const left = Math.max(0, game.votingsLeft);

        leftEl.textContent =
            "⚖️ Możliwe głosowania tego dnia: " +
            left + "/" + MAX_DAY_VOTINGS;

        neededEl.textContent =
            "🗳️ Głosów potrzebnych, by wstawić kogoś na szubienicę: " +
            needed + " (żywych: " + alive + ")";

        if (btn) {
            btn.disabled = left <= 0;
        }

        const votingNeeded = document.getElementById("votingNeededInfo");

        if (votingNeeded) {
            votingNeeded.textContent =
                "Potrzeba głosów: " + needed + " (żywych: " + alive + ")";
        }

    }

    // =========================================
    // PODSUMOWANIE NOCY (OKNO)
    // =========================================
    // Na górze wielki, kolorowy WYNIK nocy (kto zginął / kto został
    // uratowany), pod kreską "Przebieg nocy" - wydarzenia po kolei.
    // Nie blokuje strony (jak showModalAlert), więc dźwięki grają.
    // result: { tone: "death" | "safe" | "neutral", label, main, detail }

    function showNightSummary(nightNumber, result, steps, extras) {

        return new Promise(function (resolve) {

            const modal = document.getElementById("nightSummaryModal");
            const ok = document.getElementById("nsOk");

            if (!modal || !ok) {

                alert(
                    "Noc " + nightNumber + ": " + result.main +
                    "\n\n" + steps.join("\n")
                );

                resolve();

                return;

            }

            document.getElementById("nsTitle").textContent =
                "🌙 Podsumowanie nocy " + nightNumber;

            document.getElementById("nsResult").className =
                "ns-result tone-" + result.tone;

            document.getElementById("nsResultLabel").textContent =
                result.label;

            document.getElementById("nsResultMain").textContent =
                result.main;

            document.getElementById("nsResultDetail").textContent =
                result.detail || "";

            const list = document.getElementById("nsSteps");

            list.innerHTML = "";

            steps.forEach(function (text) {

                const li = document.createElement("li");

                li.textContent = text;

                list.appendChild(li);

            });

            document.getElementById("nsStepsSection").style.display =
                steps.length ? "block" : "none";

            const extrasBox = document.getElementById("nsExtras");

            extrasBox.innerHTML = "";

            extras.forEach(function (text) {

                const div = document.createElement("div");

                div.className = "ns-extra";

                div.textContent = text;

                extrasBox.appendChild(div);

            });

            modal.classList.add("open");

            document.getElementById("nightSummaryBox").scrollTop = 0;

            let closed = false;

            const close = function () {

                if (closed) return;

                closed = true;

                modal.classList.remove("open");

                ok.removeEventListener("click", close);

                document.removeEventListener("keydown", onKey);

                resolve();

            };

            const onKey = function (e) {

                if (e.key === "Enter" || e.key === "Escape") {

                    e.preventDefault();

                    close();

                }

            };

            ok.addEventListener("click", close);

            document.addEventListener("keydown", onKey);

            ok.focus();

        });

    }

    // =========================================
    // KARTY W INSTRUKCJI - POWIĘKSZENIE PO KLIKNIĘCIU
    // =========================================

    (function initCardLightbox() {

        const box = document.getElementById("cardLightbox");
        const img = document.getElementById("cardLightboxImg");

        if (!box || !img) return;

        document.addEventListener("click", function (e) {

            const cardImg = e.target.closest
                ? e.target.closest(".role-card-image img")
                : null;

            if (cardImg) {

                img.src = cardImg.src;

                img.alt = cardImg.alt || "";

                box.classList.add("open");

                return;

            }

            if (box.classList.contains("open")) {

                box.classList.remove("open");

            }

        });

        document.addEventListener("keydown", function (e) {

            if (e.key === "Escape") {

                box.classList.remove("open");

            }

        });

    })();


    // =========================================
    // TIMER DNIA
    // =========================================

    function startDayTimer() {

        clearInterval(game.dayTimerInterval);

        game.dayStartedAt = Date.now();

        updateDayTimer();

        game.dayTimerInterval = setInterval(
            updateDayTimer,
            1000
        );
    }

    function updateDayTimer() {

        if (!game.dayStartedAt) {
            return;
        }

        const elapsed =
            Math.floor(
                (Date.now() - game.dayStartedAt) / 1000
            );

        const minutes =
            Math.floor(elapsed / 60);

        const seconds =
            elapsed % 60;

        const formattedMinutes =
            String(minutes).padStart(2, "0");

        const formattedSeconds =
            String(seconds).padStart(2, "0");

        document.getElementById(
            "dayTimer"
        ).textContent =
            "⏱️ " +
            formattedMinutes +
            ":" +
            formattedSeconds;
    }

    // =========================================
    // GŁOSOWANIE - ROZPOCZĘCIE
    // =========================================

    function startVoting() {

        if (game.votingsLeft <= 0) {

            alert(
                "Limit głosowań w tym dniu został wykorzystany. " +
                "Rozpocznij noc."
            );

            return;
        }

        updateDayVotingInfo();

        document.getElementById("dayActions").style.display = "none";

        document.getElementById("votingAction").style.display = "block";

        generateVotingTargets();

    }

    function startPeacemakerAction() {

        const peacemaker =
            players.find(
                player =>
                    player.role === "Rozjemca" &&
                    player.alive
            );

        if (!peacemaker) {

            alert(
                "Rozjemca nie żyje lub nie znajduje się w grze."
            );

            return;
        }


        if (peacemaker.peacemakerUsed) {

            alert(
                "Rozjemca wykorzystał już swoją umiejętność."
            );

            return;
        }


        // Ukrywamy główny panel dnia

        document.getElementById(
            "dayActions"
        ).style.display = "none";


        // Pokazujemy panel Rozjemcy

        document.getElementById(
            "peacemakerAction"
        ).style.display = "block";


        document.getElementById(
            "peacemakerInfo"
        ).textContent =
            "Rozjemca: " +
            peacemaker.name +
            " — wybierz osobę, do której strzela.";


        generatePeacemakerTargets();

    }

    function generatePeacemakerTargets() {

        const select =
            document.getElementById(
                "peacemakerTarget"
            );

        select.innerHTML = "";


        const peacemaker =
            players.find(
                player =>
                    player.role === "Rozjemca"
                    && player.alive
            );


        players.forEach(player => {

            if (!player.alive) {
                return;
            }


            if (player.id === peacemaker.id) {
                return;
            }


            const option =
                document.createElement("option");

            option.value =
                player.id;

            option.textContent =
                player.name;

            select.appendChild(option);

        });

    }

    function isGoodRole(role) {

        return GOOD_ROLES.includes(role);
    }

    // =========================================
    // FRAKCJA - Z UWZGLĘDNIENIEM WROBIENIA
    // =========================================
    // NOWOŚĆ: Fałszerz odwraca postrzeganą frakcję wskazanej osoby
    // TYLKO na tę noc. Te funkcje zwracają "prawdziwą" oraz
    // "efektywną" (po ewentualnym odwróceniu) kategorię frakcji -
    // używane przez Szamana i Wieszcza zamiast bezpośredniego
    // sprawdzania roli, żeby wrobienie realnie wpływało na ich wyniki.

    function getFactionCategory(role) {

        if (isGoodRole(role)) return "good";
        if (EVIL_ROLES.includes(role)) return "evil";
        return "neutral";

    }

    function getEffectiveFactionCategory(player) {

        const category = getFactionCategory(player.role);

        const isFramed =
            game.currentNight.falszerz === player.id;

        if (!isFramed) return category;

        // Odwracamy dobra<->zła. Wrobiona rola neutralna (Błazen)
        // jest na tę noc traktowana jako ZŁA.

        if (category === "good") return "evil";
        if (category === "evil") return "good";
        if (category === "neutral") return "evil";

        return category;

    }


    async function confirmPeacemakerAction() {

        const peacemaker =
            players.find(
                player =>
                    player.role === "Rozjemca"
                    && player.alive
            );


        const targetId =
            parseInt(
                document.getElementById(
                    "peacemakerTarget"
                ).value
            );


        const target =
            players.find(
                player => player.id === targetId
            );


        if (!peacemaker || !target) {

            alert("Nieprawidłowy wybór.");

            return;
        }


        const confirmed =
            confirm(
                "⚔️ " +
                peacemaker.name +
                " strzela do " +
                target.name +
                ".\n\n" +
                "Czy na pewno?"
            );


        if (!confirmed) {
            return;
        }


        // Umiejętność została wykorzystana

        peacemaker.peacemakerUsed = true;

        peacemaker.revealed = true;


        // Cel umiera

        target.alive = false;

        target.deathReason =
            "peacemaker";

        target.deathDay =
            game.day;


        game.history.push({

            type: "death",

            day: game.day,

            playerId: target.id,

            playerName: target.name,

            reason: "peacemaker",

            role: target.role

        });


        // NOWOŚĆ: Błazen zastrzelony przez Rozjemcę - żywa Szarlatanka
        // zmieni się w Rozpaczoną w KOLEJNEJ nocy.
        if (target.role === "Błazen") {

            const szarlatankaToDespair = players.find(
                p => p.role === "Szarlatanka"
                    && p.alive
                    && !p.despaired
            );

            if (szarlatankaToDespair) {
                szarlatankaToDespair.despairPending = true;
            }

        }

        // Czy cel był dobry?

        const targetWasGood =
            isGoodRole(target.role);


        document.getElementById(
            "peacemakerAction"
        ).style.display = "none";


        // Jeżeli dobry → Rozjemca również umiera

        if (targetWasGood) {

            // Dźwięk: pomyłka Rozjemcy (zabił dobrego, sam ginie)
            playSfx("peacemakerMistakeSound");

            peacemaker.alive = false;

            peacemaker.deathReason =
                "peacemaker_mistake";

            peacemaker.deathDay =
                game.day;


            game.history.push({

                type: "death",

                day: game.day,

                playerId: peacemaker.id,

                playerName: peacemaker.name,

                reason: "peacemaker_mistake",

                role: peacemaker.role

            });


            // Dźwięk strzału gra już w trakcie komunikatu
            await alertWithSfx("peacemakerShotSound",

                "💥 Rozjemca " +
                peacemaker.name +
                " zastrzelił dobrą osobę!\n\n" +

                target.name +
                " umiera.\n" +

                "Rozjemca również umiera."

            );

        }

        else {

            // Dźwięk strzału gra już w trakcie komunikatu
            await alertWithSfx("peacemakerShotSound",

                "⚔️ Rozjemca zastrzelił " +
                target.name +
                ".\n\n" +

                target.name +
                " umiera."

            );

        }


        updateAliveCount();

        displayPlayers();


        // POPRAWKA: sprawdzamy warunki zwycięstwa po każdej śmierci
        const gameEnded = checkWinConditions();

        if (gameEnded) {
            return;
        }


        document.getElementById(
            "dayActions"
        ).style.display = "block";

    }

    function cancelPeacemakerAction() {

        document.getElementById(
            "peacemakerAction"
        ).style.display = "none";


        document.getElementById(
            "dayActions"
        ).style.display = "block";

    }
    // =========================================
    // GŁOSOWANIE - LISTA GRACZY
    // =========================================

    function generateVotingTargets() {

        const select =
            document.getElementById("votingTarget");

        select.innerHTML = "";


        players.forEach(player => {

            // Można wygłosować tylko żywego gracza

            if (!player.alive) {
                return;
            }


            const option =
                document.createElement("option");

            option.value = player.id;

            option.textContent = player.name;

            select.appendChild(option);

        });

    }


    // =========================================
    // GŁOSOWANIE - POTWIERDZENIE
    // =========================================

    // Krok 1: Mistrz Gry wybiera, kto wchodzi na szubienicę.
    // Pokazujemy imię, rolę i przyciski wyroku.

    function openGallows() {

        const select =
            document.getElementById("votingTarget");

        const targetId =
            parseInt(select.value);

        const target =
            players.find(
                player => player.id === targetId
            );

        if (!target) {

            alert("Wybierz gracza.");

            return;

        }

        gallowsTargetId = target.id;

        document.getElementById("gallowsName").textContent =
            target.name;

        document.getElementById("gallowsRole").textContent =
            "Rola: " + getRoleLabel(target);

        document.getElementById("votingAction").style.display = "none";

        document.getElementById("gallowsAction").style.display = "block";

    }

    // "Wróć" - z powrotem do wyboru gracza na szubienicę
    // (osądzenie się nie liczy).

    function backFromGallows() {

        gallowsTargetId = null;

        document.getElementById("gallowsAction").style.display = "none";

        document.getElementById("votingAction").style.display = "block";

    }

    // Wyrok: NIEWINNY - gracz zostaje w grze, wracamy do panelu dnia,
    // a licznik możliwych głosowań maleje (np. 2/2 -> 1/2).

    function confirmInnocent() {

        gallowsTargetId = null;

        game.votingsLeft = Math.max(0, game.votingsLeft - 1);

        document.getElementById("gallowsAction").style.display = "none";

        document.getElementById("dayActions").style.display = "block";

        updateDayVotingInfo();

    }

    // Wyrok: WINNY - gracz ginie (dźwięk wygłosowania gra jak dotąd).

    function confirmGuilty() {

        const target =
            players.find(
                player => player.id === gallowsTargetId
            );

        if (!target) {

            backFromGallows();

            return;

        }

        gallowsTargetId = null;

        game.votingsLeft = Math.max(0, game.votingsLeft - 1);


        // =====================================
        // ŚMIERĆ
        // =====================================

        target.alive = false;

        target.deathReason = "voting";

        target.deathDay = game.day;


        game.history.push({

            type: "death",

            day: game.day,

            playerId: target.id,

            playerName: target.name,

            reason: "voting",

            role: target.role

        });


        document.getElementById(
            "gallowsAction"
        ).style.display = "none";


        updateAliveCount();

        displayPlayers();


        // =====================================
        // BŁAZEN
        // =====================================

        if (target.role === "Błazen") {

            // Dźwięk: zwycięstwo Błazna (także gdy wygrywa z Szarlatanką)
            playSfx("jesterWinSound");

            // NOWOŚĆ: jeśli w grze jest Szarlatanka (żywa lub nie),
            // wygrywa razem z Błaznem.

            const szarlatanka = getRoleHolder("Szarlatanka");

            if (szarlatanka) {

                showGameOver(

                    "🤡🎭 BŁAZEN I SZARLATANKA WYGRYWAJĄ!",

                    target.name +
                    " został wygłosowany i spełnił swój cel. " +
                    "Razem z nim wygrywa Szarlatanka (" +
                    szarlatanka.name + ")."

                );

            } else {

                showGameOver(

                    "🤡 BŁAZEN WYGRYWA!",

                    target.name +
                    " został wygłosowany i spełnił swój cel."

                );

            }

            return;
        }


        // =====================================
        // WARUNKI ZWYCIĘSTWA (Mafia / Miasto)
        // =====================================
        // POPRAWKA: dodano automatyczne sprawdzenie zwycięstwa
        // po głosowaniu.

        const gameEnded = checkWinConditions();

        if (gameEnded) {
            return;
        }


        document.getElementById(
            "dayActions"
        ).style.display = "block";

        // =====================================
        // NORMALNA ŚMIERĆ
        // =====================================

        // Dźwięk: gracz wygłosowany - gra już w trakcie komunikatu
        alertWithSfx("votingDeathSound",

            "☠️ " +
            target.name +
            " został wygłosowany."

        );

    }


    // =========================================
    // ANULOWANIE GŁOSOWANIA
    // =========================================

    function cancelVoting() {

        gallowsTargetId = null;

        document.getElementById(
            "votingAction"
        ).style.display = "none";


        document.getElementById(
            "dayActions"
        ).style.display = "block";

    }

    // =========================================
    // ZMIANA EKRANU
    // =========================================

    function showScreen(screenId) {

        document.querySelectorAll(".screen").forEach(screen => {
            screen.classList.remove("active");
        });

        document.getElementById(screenId).classList.add("active");
    }


    // =========================================
    // NOWA GRA
    // =========================================

    function newGame() {

        // Limit graczy = liczba ról dostępnych w aktualnym trybie
        // (każda rola może być przypisana tylko jednemu graczowi).

        document.getElementById(
            "playerCount"
        ).max = getActiveRoles().length;


        showScreen("newGameScreen");

    }


    // =========================================
    // TWORZENIE LISTY GRACZY
    // =========================================

    function createPlayers() {

        const playerCount =
            parseInt(document.getElementById("playerCount").value);

        const maxPlayers =
            getActiveRoles().length;


        if (
            Number.isNaN(playerCount) ||
            playerCount < 4 ||
            playerCount > maxPlayers
        ) {

            alert(
                "Liczba graczy musi wynosić od 4 do " +
                maxPlayers +
                "."
            );

            return;
        }


        // Czyścimy poprzednią listę
        players = [];


        // Tworzymy obiekty graczy

        for (let i = 0; i < playerCount; i++) {

            players.push({

                id: i + 1,

                name: "",

                role: "",

                alive: true,

                revealed: false,

                peacemakerUsed: false,

                // NOWOŚĆ: Guślarz przeżywa pierwszy atak Mafii -
                // ta flaga zaznacza, że odporność została już zużyta.
                guslarAttacked: false,

                // NOWOŚĆ: Szarlatanka traci Błazna (zginął od Mafii) i
                // staje się "Rozpaczoną Szarlatanką" - nowy cel: przeżyć.
                despaired: false,

                // POPRAWKA: Medyk może uleczyć SIEBIE tylko raz w grze.
                medicSelfHealUsed: false,

                // Szarlatanka: Błazen zginął za dnia (od Rozjemcy) -
                // zmieni się w Rozpaczoną w kolejnej nocy.
                despairPending: false,

                deathReason: null,

                deathDay: null,

                deathNight: null

            });

        }


        generatePlayerInputs();

        showScreen("playersScreen");

    }


    // =========================================
    // GENEROWANIE FORMULARZA GRACZY
    // =========================================

    function generatePlayerInputs() {

        const container =
            document.getElementById("playersContainer");

        // Zapamiętujemy przewinięcie - czyszczenie kontenera zerowałoby
        // je i lista skakałaby na górę po każdej zmianie roli.

        const savedScroll = container.scrollTop;

        container.innerHTML = "";


        players.forEach((player, index) => {

            const playerCard =
                document.createElement("div");

            playerCard.className = "player-card";


            // Numer gracza

            const number =
                document.createElement("div");

            number.className = "player-number";

            number.textContent =
                "Gracz " + (index + 1);


            // Pole imienia

            const nameInput =
                document.createElement("input");

            nameInput.type = "text";

            nameInput.placeholder =
                "Imię gracza";

            nameInput.value =
                player.name;


            nameInput.addEventListener("input", function () {

                players[index].name = this.value;

            });


            // Lista ról

            const roleSelect =
                document.createElement("select");


            // Domyślna opcja

            const defaultOption =
                document.createElement("option");

            defaultOption.value = "";

            defaultOption.textContent =
                "Wybierz rolę";

            roleSelect.appendChild(defaultOption);


            // Dodajemy wszystkie role

            // POPRAWKA: lista ról zależy teraz od wybranego trybu gry

            getActiveRoles().forEach(role => {

                const option =
                    document.createElement("option");

                option.value = role;

                option.textContent = role;

                const roleTaken = players.some((otherPlayer, otherIndex) => {

                    return otherIndex !== index &&
                        otherPlayer.role === role;

                });

                if (roleTaken) {
                    option.disabled = true;
                }

                roleSelect.appendChild(option);

            });


            roleSelect.value =
                player.role;


            roleSelect.addEventListener("change", function () {

                players[index].role = this.value;

                generatePlayerInputs();
            });


            playerCard.appendChild(number);

            playerCard.appendChild(nameInput);

            playerCard.appendChild(roleSelect);


            container.appendChild(playerCard);

        });

        container.scrollTop = savedScroll;

    }


    // =========================================
    // ROZPOCZĘCIE GRY
    // =========================================

    function startGame() {

        // Sprawdzamy role

        const selectedRoles = players
            .map(player => player.role)
            .filter(role => role !== "");

        const uniqueRoles = new Set(selectedRoles);

        if (selectedRoles.length !== uniqueRoles.size) {

            alert("Każda rola może być przypisana tylko jednemu graczowi.");

            return;
        }


        // Szarlatanka wygrywa razem z Błaznem - bez Błazna w grze
        // jej cel nie miałby sensu.

        if (
            selectedRoles.includes("Szarlatanka")
            && !selectedRoles.includes("Błazen")
        ) {

            alert(
                "Szarlatanka wymaga obecności Błazna w grze. " +
                "Przypisz rolę Błazna któremuś z graczy."
            );

            return;
        }


        // Pomocnik Mafii: w jednej grze może być tylko Informator ALBO
        // Fałszerz (mają wspólny panel nocny).

        if (
            selectedRoles.includes("Informator")
            && selectedRoles.includes("Fałszerz")
        ) {

            alert(
                "W jednej grze może być tylko jeden pomocnik Mafii: " +
                "Informator albo Fałszerz. Zostaw jedną z tych ról."
            );

            return;
        }


        // Sprawdzamy imiona i role

        for (let i = 0; i < players.length; i++) {

            if (players[i].name.trim() === "") {

                alert(
                    "Gracz " +
                    (i + 1) +
                    " nie ma wpisanego imienia."
                );

                return;
            }


            if (players[i].role === "") {

                alert(
                    "Gracz " +
                    players[i].name +
                    " nie ma przypisanej roli."
                );

                return;
            }

        }


        // Imiona muszą być różne (bez względu na wielkość liter i
        // spacje na brzegach) - inaczej gracze zlewają się na listach.

        const seenNames = new Set();

        for (let i = 0; i < players.length; i++) {

            const key = players[i].name.trim().toLowerCase();

            if (seenNames.has(key)) {

                alert(
                    "Imiona graczy muszą być różne. Powtarza się: " +
                    players[i].name.trim() +
                    "."
                );

                return;
            }

            seenNames.add(key);
        }


        // W grze musi być przynajmniej jedna rola zła - inaczej
        // Miasto "wygrywa" przy pierwszym sprawdzeniu.

        const evilCount =
            players.filter(p => EVIL_ROLES.includes(p.role)).length;

        // POPRAWKA: neutralni też liczą się jako "reszta" przeciw Mafii.
        const goodCount =
            players.filter(p => !EVIL_ROLES.includes(p.role)).length;

        if (evilCount === 0) {

            alert(
                "W grze musi być przynajmniej jedna rola zła " +
                "(np. Mafia)."
            );

            return;
        }


        // Niezbalansowany start: zli mają co najmniej tyle osób co
        // dobrzy, więc Mafia wygra po pierwszej akcji.

        if (evilCount >= goodCount) {

            const proceed = confirm(
                "Zła drużyna (" + evilCount + ") ma co najmniej " +
                "tyle osób co pozostali gracze (" + goodCount + "). Mafia " +
                "wygra zaraz po pierwszej akcji. Rozpocząć mimo to?"
            );

            if (!proceed) return;
        }


        // Zapisujemy imiona bez spacji na brzegach

        players.forEach(p => { p.name = p.name.trim(); });


        // Resetujemy stan rozgrywki

        game.day = 1;
        game.night = 0;
        game.phase = "day";
        game.history = [];
        game.previousAlcoholicTarget = null;
        game.previousFalszerzTarget = null;

        // POPRAWKA: bez tego stara historia odwiedzin Guślarza
        // (z poprzedniej, zupełnie innej rozgrywki) mogłaby zostać
        // pokazana nowemu Guślarzowi po ataku.
        game.guslarVisits = [];


        // POPRAWKA: ukrywamy ekran końca poprzedniej rozgrywki -
        // wcześniej był resetowany tylko w newGameWithSamePlayers(),
        // więc jeśli ktoś wracał do menu głównego (goBack()) po
        // wygranej i zaczynał zupełnie nową grę przez startGame(),
        // stary komunikat "Koniec gry" zostawał widoczny pod
        // panelem dnia (bo showScreen() przełącza tylko główne
        // ekrany, a gameOverScreen jest elementem WEWNĄTRZ gameScreen
        // ze swoim własnym, niezależnym style.display).

        document.getElementById(
            "gameOverScreen"
        ).style.display = "none";


        // Wyświetlamy informacje

        document.getElementById(
            "playerCountDisplay"
        ).textContent = players.length;


        // Wyświetlamy graczy

        displayPlayers();


        // Aktualizujemy liczbę żywych

        updateAliveCount();


        // Pokazujemy dzień 1

        showDay();


        // Przechodzimy do ekranu gry

        showScreen("gameScreen");

    }


    // =========================================
    // WYŚWIETLANIE GRACZY
    // =========================================

    function displayPlayers() {

        const container =
            document.getElementById(
                "gamePlayerList"
            );

        container.innerHTML = "";


        players.forEach(player => {

            const playerElement =
                document.createElement("div");

            playerElement.className =
                "game-player";


            // Martwy gracz

            if (!player.alive) {

                playerElement.classList.add(
                    "dead"
                );

            }


            const name =
                document.createElement("div");

            name.className =
                "game-player-name";


            const deadMark =
                document.createElement("span");

            deadMark.className =
                "dead-mark";


            deadMark.textContent =
                player.alive
                    ? "🟢"
                    : "☠️";


            name.appendChild(deadMark);


            const nameText =
                document.createTextNode(
                    player.name
                );

            name.appendChild(nameText);


            // POPRAWKA: znaczek przy graczu, którego rola jest
            // publicznie znana - np. Rozjemca, który strzelił w dzień
            // na oczach wszystkich, więc jego rola jest gwarantowana.

            if (player.revealed) {

                const revealedBadge =
                    document.createElement("span");

                revealedBadge.className =
                    "revealed-badge";

                revealedBadge.textContent =
                    "👁️ rola ujawniona";

                name.appendChild(revealedBadge);

            }


            const role =
                document.createElement("div");

            role.className =
                "game-player-role";


            role.textContent =
                getRoleLabel(player);


            playerElement.appendChild(name);

            playerElement.appendChild(role);


            container.appendChild(
                playerElement
            );

        });

    }


    // =========================================
    // POWRÓT DO MENU
    // =========================================

    function goBack() {

        stopNightMusic();

        showScreen("mainScreen");

    }

    // =========================================
    // LICZBA ŻYWYCH GRACZY
    // =========================================

    function updateAliveCount() {

        const alivePlayers =
            players.filter(player => player.alive);

        document.getElementById(
            "aliveCountDisplay"
        ).textContent = alivePlayers.length;

        // Próg głosów zależy od liczby żywych
        updateDayVotingInfo();

    }

    // =========================================
    // DZIEŃ
    // =========================================

    function showDay() {

        game.phase = "day";

        // Nowy dzień = komplet możliwych głosowań
        game.votingsLeft = MAX_DAY_VOTINGS;

        gallowsTargetId = null;

        stopNightMusic();

        document.getElementById(
            "phaseTitle"
        ).textContent =
            "Dzień " + game.day;

        document.getElementById(
            "dayActions"
        ).style.display = "block";

        document.getElementById(
            "nightActions"
        ).style.display = "none";

        updateAliveCount();

        startDayTimer();

    }


    // =========================================
    // ROZPOCZĘCIE NOCY
    // =========================================

    function startNight() {

        clearInterval(game.dayTimerInterval);

        game.phase = "night";

        game.night++;

        // NOWOŚĆ: muzyka nocna startuje razem z nocą
        startNightMusic();

        // Czyścimy akcje poprzedniej nocy
        game.currentNight = {

            alcoholic: null,
            alcoholicBlocked: null,
            medic: null,
            falszerz: null,
            shaman: null,
            wieszcz: null,
            mafia: null,
            informator: null,
            obserwator: null,
            visits: {},
            log: []

        };

        document.getElementById(
            "phaseTitle"
        ).textContent = "Noc " + game.night;


        // Ukrywamy dzień
        document.getElementById(
            "dayActions"
        ).style.display = "none";


        // POPRAWKA: resetujemy widoczność wszystkich paneli nocnych
        // na start (nightStart widoczny, reszta ukryta), aby stan
        // z poprzedniej nocy nie "przeciekał" do kolejnej.

        document.getElementById("nightStart").style.display = "block";
        document.getElementById("szarlatankaAction").style.display = "none";
        document.getElementById("alcoholicAction").style.display = "none";
        document.getElementById("medicAction").style.display = "none";
        document.getElementById("helperAction").style.display = "none";
        document.getElementById("shamanAction").style.display = "none";
        document.getElementById("wieszczAction").style.display = "none";
        document.getElementById("helperAction").style.display = "none";
        document.getElementById("mafiaAction").style.display = "none";
        document.getElementById("obserwatorAction").style.display = "none";


        // Pokazujemy panel nocy (i zostawiamy go widocznym przez
        // całą noc - poszczególne pod-panele są jego rodzeństwem
        // wewnętrznym i przełączają się nawzajem)

        document.getElementById(
            "nightActions"
        ).style.display = "block";


        updateAliveCount();

    }

    // =========================================
    // INFORMACJA O BLOKADZIE ALKOHOLIKA
    // =========================================
    // NOWOŚĆ: gdy Alkoholik zablokował osobę, jej panel pokazuje
    // czerwoną informację OD RAZU po otwarciu (Alkoholik działa jako
    // pierwszy, więc blokada jest już znana) - zanim Mistrz Gry
    // cokolwiek wybierze. Baner jest tworzony dynamicznie na górze
    // panelu, więc nie wymaga zmian w HTML.

    function showBlockedNotice(panelId, player) {

        const panel = document.getElementById(panelId);

        if (!panel) return;

        let notice = panel.querySelector(".blocked-notice");

        if (!notice) {

            notice = document.createElement("div");

            notice.className = "blocked-notice";

            const heading = panel.querySelector("h2");

            if (heading && heading.nextSibling) {
                panel.insertBefore(notice, heading.nextSibling);
            } else {
                panel.insertBefore(notice, panel.firstChild);
            }

        }

        const isBlocked =
            player
            && game.currentNight
            && game.currentNight.alcoholicBlocked === player.id;

        if (isBlocked) {

            notice.textContent =
                "🍺 " + player.name +
                " został zablokowany przez Alkoholika - " +
                "jego akcja tej nocy nie przyniesie skutku.";

            notice.style.display = "block";

        } else {

            notice.textContent = "";

            notice.style.display = "none";

        }

    }

    // =========================================
    // POCZĄTEK NOCY - KOLEJNOŚĆ AKCJI
    // =========================================
    // NOWOŚĆ: przycisk "Rozpocznij noc" wywołuje tę funkcję. W
    // pierwszej nocy trybu zaawansowanym jako PIERWSZA wykonuje się
    // akcja Szarlatanki (przed Alkoholikiem). W każdej innej sytuacji
    // noc zaczyna się normalnie od Alkoholika.

    function startNightSequence() {

        // POPRAWKA: w pierwszej nocy trybu zaawansowanego panel
        // Szarlatanki pokazuje się ZAWSZE - także gdy jej nie ma w
        // grze (wtedy napisze, że jej nie ma). Dzięki temu gracze nie
        // wywnioskują z przebiegu nocy, czy ta rola bierze udział.

        if (game.night === 1 && gameMode === "advanced") {

            startSzarlatankaAction();

            return;

        }

        startAlcoholicAction();

    }

    // =========================================
    // SZARLATANKA - ROZPOCZĘCIE AKCJI
    // =========================================
    // NOWOŚĆ: rola neutralna (tryb zaawansowany). Nie wybiera celu i
    // nie wykonuje akcji, więc nie może zostać zablokowana (Alkoholik
    // jeszcze nawet nie działał) ani nie rejestruje odwiedzin.
    // Jednorazowo, na początku pierwszej nocy, panel pokazuje listę
    // ról, których NIE MA w tej rozgrywce - Mistrz Gry pokazuje
    // Szarlatance karty tych postaci.

    function getRolesNotInGame() {

        return getActiveRoles().filter(
            role => !players.some(player => player.role === role)
        );

    }

    function startSzarlatankaAction() {

        document.getElementById("nightStart").style.display = "none";

        document.getElementById(
            "szarlatankaAction"
        ).style.display = "block";

        const info = document.getElementById("szarlatankaInfo");

        const description =
            document.getElementById("szarlatankaDescription");

        const list = document.getElementById("szarlatankaRoles");

        list.innerHTML = "";

        const szarlatanka = getRoleHolder("Szarlatanka");

        // --- Szarlatanki nie ma w grze ---
        if (!szarlatanka) {

            info.textContent = "Szarlatanki nie ma w grze.";

            description.style.display = "none";

            list.style.display = "none";

            return;

        }

        // --- Szarlatanka jest, ale nie żyje ---
        if (!szarlatanka.alive) {

            info.textContent =
                describeRoleHolder("🎭", "Szarlatanka") +
                " - nie pokazuj kart.";

            description.style.display = "none";

            list.style.display = "none";

            return;

        }

        // --- Szarlatanka żyje: pokazujemy role nieobecne w grze ---
        info.textContent = describeRoleHolder("🎭", "Szarlatanka");

        description.style.display = "block";

        list.style.display = "block";

        const missingRoles = getRolesNotInGame();

        if (missingRoles.length === 0) {

            const li = document.createElement("li");

            li.textContent =
                "Wszystkie role są w tej rozgrywce - " +
                "nie ma żadnej karty do pokazania.";

            list.appendChild(li);

        } else {

            missingRoles.forEach(role => {

                const li = document.createElement("li");

                li.textContent = role;

                list.appendChild(li);

            });

        }

    }

    function confirmSzarlatankaAction() {

        const szarlatanka = getRoleHolder("Szarlatanka");

        // Wpis do dziennika tylko, gdy karty faktycznie zostały pokazane
        if (szarlatanka && szarlatanka.alive) {

            const missingRoles = getRolesNotInGame();

            logNightEvent(
                "🎭 Szarlatanka poznała role nieobecne w grze: " +
                (missingRoles.length ? missingRoles.join(", ") : "brak") + "."
            );

        }

        document.getElementById(
            "szarlatankaAction"
        ).style.display = "none";

        startAlcoholicAction();

    }

    // =========================================
    // ALKOHOLIK - ROZPOCZĘCIE AKCJI
    // =========================================

    function startAlcoholicAction() {

        // POPRAWKA: przełączamy tylko panele WEWNĄTRZ #nightActions
        // (nightStart -> alcoholicAction), a nie sam #nightActions,
        // który musi pozostać widoczny przez całą noc.

        document.getElementById(
            "nightStart"
        ).style.display = "none";


        document.getElementById(
            "alcoholicAction"
        ).style.display = "block";


        // POPRAWKA: pokazujemy kto jest Alkoholikiem i czy żyje,
        // niezależnie od statusu (wcześniej pokazywało tylko imię,
        // gdy żył, a bez informacji "kto" gdy nie żył).

        document.getElementById(
            "alcoholicInfo"
        ).textContent =
            describeRoleHolder("🍺", "Alkoholik");


        generateAlcoholicTargets();

    }


    // =========================================
    // ALKOHOLIK - LISTA CELÓW
    // =========================================

    function generateAlcoholicTargets() {

        const select =
            document.getElementById("alcoholicTarget");


        // Czyścimy listę

        select.innerHTML = "";


        // Pobieramy ID osoby zablokowanej poprzedniej nocy

        const previousTarget =
            game.previousAlcoholicTarget;

        // Dodajemy tylko odpowiednich graczy

        players.forEach(player => {

            // Nie można zablokować martwego gracza

            if (!player.alive) {
                return;
            }


            // Alkoholik nie może zablokować siebie

            if (player.role === "Alkoholik") {
                return;
            }


            // Nie można zablokować tej samej osoby
            // dwa razy pod rząd

            if (player.id === previousTarget) {
                return;
            }


            const option =
                document.createElement("option");

            option.value = player.id;

            option.textContent = player.name;

            select.appendChild(option);

        });

    }


    // =========================================
    // ALKOHOLIK - ZATWIERDZENIE
    // =========================================

    function confirmAlcoholicAction() {

        const select =
            document.getElementById("alcoholicTarget");

        const targetId =
            parseInt(select.value);

        const target =
            players.find(
                player => player.id === targetId
            );


        if (!target) {

            alert("Wybierz osobę.");

            return;

        }


        const alcoholic =
            players.find(
                player =>
                    player.role === "Alkoholik" && player.alive
            );


        // Zapamiętujemy wskazany cel
        game.currentNight.alcoholic =
            target.id;


        // =========================================
        // CZY ALKOHOLIK ŻYJE?
        // =========================================

        if (alcoholic) {

            game.currentNight.alcoholicBlocked =
                target.id;

            // POPRAWKA: blokada liczy się jako ODWIEDZINY celu -
            // Obserwator zobaczy Alkoholika przy zablokowanej osobie.
            registerVisit(alcoholic.id, target.id);

            logNightEvent(
                "🍺 Alkoholik zablokował: " + target.name
            );

        } else {

            game.currentNight.alcoholicBlocked =
                null;

            logNightEvent(
                "🍺 Alkoholik nie żyje / nie występuje - noc bez blokady."
            );

        }


        // =========================================
        // ZAPISUJEMY CEL DO NASTĘPNEJ NOCY
        // =========================================

        game.previousAlcoholicTarget =
            target.id;


        // =========================================
        // DALEJ DO MEDYKA
        // =========================================

        document.getElementById(
            "alcoholicAction"
        ).style.display = "none";


        startMedicAction();

    }


    // =========================================
    // MEDYK - ROZPOCZĘCIE AKCJI
    // =========================================

    // Dopisek na panelu Medyka, gdy zużył już leczenie siebie
    function medicSelfHealNote() {

        const medic = players.find(
            p => p.role === "Medyk" && p.alive
        );

        if (medic && medic.medicSelfHealUsed) {
            return " - już uleczył siebie, nie może ponownie";
        }

        return "";

    }

    function startMedicAction() {

        document.getElementById(
            "alcoholicAction"
        ).style.display = "none";


        document.getElementById(
            "medicAction"
        ).style.display = "block";


        // POPRAWKA: pokazujemy kto jest Medykiem i czy żyje.

        document.getElementById(
            "medicInfo"
        ).textContent =
            describeRoleHolder("🩺", "Medyk") + medicSelfHealNote();


        generateMedicTargets();

        showBlockedNotice(
            "medicAction",
            getRoleHolder("Medyk")
        );

    }

    // =========================================
    // MEDYK - LISTA CELÓW
    // =========================================

    function generateMedicTargets() {

        const select =
            document.getElementById("medicTarget");


        select.innerHTML = "";

        const medic = players.find(
            p => p.role === "Medyk" && p.alive
        );


        players.forEach(player => {

            // Medyk może leczyć tylko żywych

            if (!player.alive) {
                return;
            }

            // POPRAWKA: po jednorazowym uleczeniu siebie Medyk
            // nie może już wybrać samego siebie.
            if (
                medic
                && player.id === medic.id
                && medic.medicSelfHealUsed
            ) {
                return;
            }


            const option =
                document.createElement("option");

            option.value =
                player.id;

            option.textContent =
                player.name;

            select.appendChild(option);

        });

    }

    // =========================================
    // MEDYK - ZATWIERDZENIE
    // =========================================
    // POPRAWKA: sprawdzamy, czy Medyk został zablokowany przez
    // Alkoholika tej nocy - jeśli tak, jego leczenie się nie liczy.

    function confirmMedicAction() {

        const medic =
            players.find(
                player => player.role === "Medyk" && player.alive
            );


        // POPRAWKA: jeśli Medyk nie żyje / nie występuje, jego
        // wybór nie ma znaczenia - pomijamy akcję bez wymuszania
        // wyboru celu.

        if (!medic) {

            logNightEvent(
                "🩺 Medyk nie żyje / nie występuje - noc bez akcji Medyka."
            );

            startMafiaAction();

            return;
        }


        const select =
            document.getElementById("medicTarget");


        const targetId =
            parseInt(select.value);


        const target =
            players.find(player => player.id === targetId);


        if (!target) {

            alert("Wybierz osobę.");

            return;
        }


        // Zabezpieczenie: leczenie siebie tylko raz w całej grze
        if (target.id === medic.id && medic.medicSelfHealUsed) {

            alert(
                "🩺 Medyk już raz uleczył siebie - " +
                "nie może zrobić tego ponownie."
            );

            return;
        }



        const medicBlocked =
            game.currentNight.alcoholicBlocked === medic.id;


        // POPRAWKA: informacja o blokadzie Alkoholika trafia teraz
        // do dziennika nocy zamiast osobnego alertu - zobaczysz ją
        // w zbiorczym podsumowaniu na koniec nocy.

        if (medicBlocked) {

            game.currentNight.medic = null;

            logNightEvent(
                "🍺 Medyk został zablokowany przez Alkoholika " +
                "i nie mógł nikogo tej nocy uleczyć."
            );

        } else {

            // Zapisujemy wybór Medyka

            game.currentNight.medic =
                target.id;

            registerVisit(medic.id, target.id);

            logNightEvent(
                "🩺 Medyk postanowił uleczyć: " + target.name
            );

            // Leczenie siebie zużywa jednorazową możliwość (tylko gdy
            // faktycznie się odbyło - zablokowany Medyk jej nie traci).
            if (target.id === medic.id) {
                medic.medicSelfHealUsed = true;
            }

        }


        // Następna rola: Fałszerz

        startMafiaAction();

    }

    // =========================================
    // POMOCNIK MAFII (INFORMATOR LUB FAŁSZERZ) - ROZPOCZĘCIE AKCJI
    // =========================================
    // NOWOŚĆ: Informator i Fałszerz mają wspólny panel "Budzi się
    // pomocnik Mafii". W jednej grze występuje tylko jedna z tych
    // ról (pilnuje tego walidacja w startGame), więc panel pokazuje
    // akcję tej, która jest w grze: Informator sprawdza dokładną rolę,
    // Fałszerz wrabia wskazaną osobę. Panel pokazuje się ZAWSZE (także
    // gdy pomocnik nie żyje lub go nie ma) - żeby gracze nie poznali
    // po przebiegu nocy, czy ta rola bierze udział.

    // Żywy pomocnik Mafii (Informator albo Fałszerz) lub null
    function getHelperPlayer() {

        return (
            players.find(p => p.role === "Informator" && p.alive)
            || players.find(p => p.role === "Fałszerz" && p.alive)
            || null
        );

    }

    // Nazwa roli pomocnika (także gdy nie żyje) lub null, gdy w grze
    // nie ma ani Informatora, ani Fałszerza
    function getHelperRoleName() {

        const helper = getHelperPlayer();

        if (helper) return helper.role;

        const any =
            getRoleHolder("Informator") || getRoleHolder("Fałszerz");

        return any ? any.role : null;

    }

    function startHelperAction() {

        document.getElementById("mafiaAction").style.display = "none";

        document.getElementById("helperAction").style.display = "block";

        const helper = getHelperPlayer();

        const roleName = getHelperRoleName();

        const info = document.getElementById("helperInfo");

        const label = document.getElementById("helperModeLabel");

        if (roleName === "Fałszerz") {

            info.textContent = describeRoleHolder("🃏", "Fałszerz");

            label.textContent =
                "Wybierz osobę, którą Fałszerz wrobi tej nocy " +
                "(jej frakcja zostanie odwrócona tylko na tę noc).";

        } else if (roleName === "Informator") {

            info.textContent = describeRoleHolder("🕵️", "Informator");

            label.textContent =
                "Wybierz osobę, której dokładną rolę chcesz poznać.";

        } else {

            info.textContent =
                "Informatora ani Fałszerza nie ma w tej grze.";

            label.textContent = "";

        }

        generateHelperTargets(roleName);

        showBlockedNotice("helperAction", helper);

    }

    // =========================================
    // POMOCNIK MAFII - LISTA CELÓW
    // =========================================
    // Informator: nie może wybrać siebie ani kolegów z Mafii.
    // Fałszerz: nie może wrobić siebie ani osoby wrobionej poprzedniej
    // nocy (zablokowany Fałszerz nie "zużywa" celu).

    function generateHelperTargets(roleName) {

        const select = document.getElementById("helperTarget");

        select.innerHTML = "";

        const helper = getHelperPlayer();

        const previousTarget = game.previousFalszerzTarget;

        players.forEach(player => {

            if (!player.alive) return;

            if (helper && player.id === helper.id) return;

            if (roleName === "Fałszerz") {

                if (player.id === previousTarget) return;

            } else if (
                player.role === "Mafia" || player.role === "Fałszerz"
            ) {

                return;

            }

            const option = document.createElement("option");

            option.value = player.id;

            option.textContent = player.name;

            select.appendChild(option);

        });

    }

    // =========================================
    // POMOCNIK MAFII - ZATWIERDZENIE
    // =========================================

    function confirmHelperAction() {

        if (!getHelperPlayer()) {

            logNightEvent(
                "🕵️🃏 Pomocnik Mafii (Informator / Fałszerz) nie żyje " +
                "lub nie występuje - noc bez jego akcji."
            );

            document.getElementById("helperAction").style.display = "none";

            startShamanAction();

            return;

        }

        if (getHelperRoleName() === "Fałszerz") {

            confirmFalszerzAction();

        } else {

            confirmInformatorAction();

        }

    }

    // =========================================
    // FAŁSZERZ - ZATWIERDZENIE
    // =========================================

    function confirmFalszerzAction() {

        const falszerz =
            players.find(
                p => p.role === "Fałszerz" && p.alive
            );

        if (!falszerz) {

            logNightEvent(
                "🃏 Fałszerz nie żyje / nie występuje - noc bez akcji Fałszerza."
            );

            document.getElementById(
                "helperAction"
            ).style.display = "none";

            startShamanAction();

            return;
        }

        const select =
            document.getElementById("helperTarget");

        const targetId =
            parseInt(select.value);

        const target =
            players.find(p => p.id === targetId);

        if (!target) {

            alert("Wybierz osobę.");

            return;
        }

        const falszerzBlocked =
            game.currentNight.alcoholicBlocked === falszerz.id;

        // POPRAWKA: cel zapamiętujemy do sprawdzenia "nie dwa razy pod rząd"
        // tylko, gdy wrobienie FAKTYCZNIE się odbyło. Wcześniej zablokowany
        // Fałszerz tracił wybraną osobę (np. Błazna) na kolejną noc.

        game.previousFalszerzTarget = falszerzBlocked ? null : targetId;

        if (falszerzBlocked) {

            logNightEvent(
                "🍺 Fałszerz został zablokowany przez Alkoholika " +
                "i nie mógł nikogo tej nocy wrobić."
            );

            alert(
                "🍺 Fałszerz został zablokowany przez Alkoholika " +
                "i nie mógł nikogo tej nocy wrobić."
            );

        } else {

            game.currentNight.falszerz = targetId;

            registerVisit(falszerz.id, targetId);

            logNightEvent(
                "🃏 Fałszerz wrobił: " + target.name +
                " (jego frakcja jest odwrócona tylko tej nocy)."
            );

        }

        document.getElementById(
            "helperAction"
        ).style.display = "none";

        startShamanAction();

    }

    // =========================================
    // SZAMAN - ROZPOCZĘCIE AKCJI
    // =========================================

    function startShamanAction() {

        // POPRAWKA: poprzednim krokiem jest teraz Fałszerz, nie
        // bezpośrednio Medyk.

        document.getElementById(
            "helperAction"
        ).style.display = "none";


        document.getElementById(
            "shamanAction"
        ).style.display = "block";


        // POPRAWKA: pokazujemy kto jest Szamanem i czy żyje.

        document.getElementById(
            "shamanInfo"
        ).textContent =
            describeRoleHolder("🧙", "Szaman");


        generateShamanTargets();

        showBlockedNotice(
            "shamanAction",
            getRoleHolder("Szaman")
        );

    }

    // =========================================
    // SZAMAN - LISTA CELÓW
    // =========================================

    function generateShamanTargets() {

        const select =
            document.getElementById("shamanTarget");


        select.innerHTML = "";


        // POPRAWKA: Szaman nie może sprawdzić samego siebie.

        const shaman =
            players.find(
                player => player.role === "Szaman" && player.alive
            );


        players.forEach(player => {

            if (!player.alive) {
                return;
            }


            if (shaman && player.id === shaman.id) {
                return;
            }


            const option =
                document.createElement("option");

            option.value =
                player.id;

            option.textContent =
                player.name;

            select.appendChild(option);

        });

    }

    // =========================================
    // SZAMAN - ZATWIERDZENIE
    // =========================================
    // POPRAWKA: sprawdzamy blokadę Alkoholika przed ujawnieniem
    // frakcji - jeśli Szaman jest zablokowany, nie dowiaduje się
    // niczego tej nocy.

    function confirmShamanAction() {

        const shaman =
            players.find(
                player => player.role === "Szaman" && player.alive
            );


        // POPRAWKA: jeśli Szaman nie żyje / nie występuje, pomijamy
        // akcję bez wymuszania wyboru celu.

        if (!shaman) {

            logNightEvent(
                "🧙 Szaman nie żyje / nie występuje - noc bez akcji Szamana."
            );

            startWieszczAction();

            return;
        }


        const select =
            document.getElementById("shamanTarget");


        const targetId =
            parseInt(select.value);


        const target =
            players.find(player => player.id === targetId);


        if (!target) {

            alert("Wybierz osobę.");

            return;
        }


        // Zapisujemy wybór

        game.currentNight.shaman =
            target.id;


        const shamanBlocked =
            game.currentNight.alcoholicBlocked === shaman.id;


        if (shamanBlocked) {

            logNightEvent(
                "🍺 Szaman został zablokowany przez Alkoholika " +
                "i nie mógł nikogo tej nocy sprawdzić."
            );

            // POPRAWKA: natychmiastowy alert o blokadzie

            alert(
                "🍺 Szaman został zablokowany przez Alkoholika " +
                "i nie mógł nikogo tej nocy sprawdzić."
            );

        } else {

            // Odwiedziny rejestrujemy TYLKO gdy Szaman nie jest
            // zablokowany przez Alkoholika.
            registerVisit(shaman.id, target.id);

            // Ustalamy frakcję celu (z uwzględnieniem ewentualnego
            // wrobienia przez Fałszerza tej nocy)

            const effectiveCategory =
                getEffectiveFactionCategory(target);

            const isGood =
                effectiveCategory === "good";


            const faction =
                isGood
                    ? "DOBRA"
                    : "ZŁA / NEUTRALNA";


            logNightEvent(
                "🧙 Szaman sprawdził " +
                target.name +
                " - frakcja: " +
                faction
            );


            // POPRAWKA: Szaman jest wyjątkiem - w przeciwieństwie do
            // pozostałych ról, jego wynik pokazujemy OD RAZU (nie
            // czekamy na zbiorcze podsumowanie nocy), bo MG musi
            // natychmiast przekazać tę informację graczowi.

            alert(
                "🧙 Szaman sprawdził: " +
                target.name +
                "\n\nFrakcja: " +
                faction
            );

        }


        // Następna rola: Wieszcz

        startWieszczAction();

    }


    // =========================================
    // WIESZCZ - ROZPOCZĘCIE AKCJI
    // =========================================

    function startWieszczAction() {

        // POPRAWKA: Wieszcz nie istnieje w trybie podstawowym - w
        // ogóle pomijamy ten krok (bez panelu, bez wzmianki w logu),
        // żeby role trybu zaawansowanego nie przenikały do gry
        // podstawowej.

        if (gameMode !== "advanced") {

            startObserwatorAction();

            return;
        }


        document.getElementById(
            "shamanAction"
        ).style.display = "none";

        document.getElementById(
            "wieszczAction"
        ).style.display = "block";

        document.getElementById(
            "wieszczInfo"
        ).textContent =
            describeRoleHolder("🔮", "Wieszcz");

        generateWieszczTargets();

        showBlockedNotice(
            "wieszczAction",
            getRoleHolder("Wieszcz")
        );

    }

    // =========================================
    // WIESZCZ - LISTA CELÓW
    // =========================================
    // Wieszcz nie może wybrać samego siebie w żadnym z pól.
    // Logika uniemożliwiająca wybranie tej samej osoby dwa razy
    // jest obsługiwana przy zatwierdzaniu.

    function generateWieszczTargets() {

        const wieszcz =
            players.find(
                p => p.role === "Wieszcz" && p.alive
            );

        [
            document.getElementById("wieszczTarget1"),
            document.getElementById("wieszczTarget2")
        ].forEach(select => {

            select.innerHTML = "";

            players.forEach(player => {

                if (!player.alive) return;

                if (wieszcz && player.id === wieszcz.id) return;

                const option = document.createElement("option");
                option.value = player.id;
                option.textContent = player.name;
                select.appendChild(option);

            });

        });

    }

    // =========================================
    // WIESZCZ - ZATWIERDZENIE
    // =========================================

    function confirmWieszczAction() {

        const wieszcz =
            players.find(
                p => p.role === "Wieszcz" && p.alive
            );

        if (!wieszcz) {

            logNightEvent(
                "🔮 Wieszcz nie żyje / nie występuje - noc bez akcji Wieszcza."
            );

            document.getElementById(
                "wieszczAction"
            ).style.display = "none";

            startObserwatorAction();

            return;
        }

        const id1 =
            parseInt(document.getElementById("wieszczTarget1").value);

        const id2 =
            parseInt(document.getElementById("wieszczTarget2").value);

        if (id1 === id2) {

            alert("Wybierz dwie RÓŻNE osoby.");

            return;
        }

        const target1 = players.find(p => p.id === id1);
        const target2 = players.find(p => p.id === id2);

        if (!target1 || !target2) {

            alert("Nieprawidłowy wybór.");

            return;
        }

        game.currentNight.wieszcz = [id1, id2];


        const wieszczBlocked =
            game.currentNight.alcoholicBlocked === wieszcz.id;

        if (wieszczBlocked) {

            logNightEvent(
                "🍺 Wieszcz został zablokowany przez Alkoholika " +
                "i nie mógł nic sprawdzić tej nocy."
            );

            alert(
                "🍺 Wieszcz został zablokowany przez Alkoholika " +
                "i nie mógł nic sprawdzić tej nocy."
            );

        } else {

            // Wieszcz odwiedza obie osoby (widoczne dla Obserwatora)
            // TYLKO gdy nie jest zablokowany przez Alkoholika.
            registerVisit(wieszcz.id, target1.id);
            registerVisit(wieszcz.id, target2.id);

            // POPRAWKA: porównujemy EFEKTYWNĄ frakcję (uwzględniającą
            // ewentualne wrobienie przez Fałszerza tej nocy), a nie
            // bezpośrednio rolę.

            const sameFaction =
                getEffectiveFactionCategory(target1) ===
                getEffectiveFactionCategory(target2);

            const result =
                sameFaction
                    ? "TAK — należą do tej samej frakcji."
                    : "NIE — należą do różnych frakcji.";

            logNightEvent(
                "🔮 Wieszcz sprawdził " +
                target1.name + " i " + target2.name +
                " — " + result
            );

            // Alert od razu (jak Szaman i Informator)

            alert(
                "🔮 Wieszcz sprawdził:\n" +
                target1.name + " i " + target2.name +
                "\n\n" + result
            );

        }

        document.getElementById(
            "wieszczAction"
        ).style.display = "none";

        startObserwatorAction();

    }


    // =========================================
    // MAFIA - ROZPOCZĘCIE AKCJI
    // =========================================
    // POPRAWKA: Mafia działa teraz PRZED Informatorem. Panel Mafii
    // zostaje widoczny nawet gdy główna Mafia nie żyje - wtedy
    // dopisek mniejszą czcionką informuje, że decyzję o zabójstwie
    // podejmuje w jej imieniu Informator.

    function startMafiaAction() {

        document.getElementById(
            "medicAction"
        ).style.display = "none";


        document.getElementById(
            "mafiaAction"
        ).style.display = "block";


        document.getElementById(
            "mafiaInfo"
        ).textContent =
            describeRoleHolder("🔫", "Mafia");


        // POPRAWKA: hierarchia zabójcy to teraz Mafia -> Informator
        // -> Fałszerz (Fałszerz przejmuje dopiero, gdy ZARÓWNO Mafia,
        // JAK I Informator nie żyją).

        const mafiaAlive =
            players.some(
                player => player.role === "Mafia" && player.alive
            );

        const informatorAlive =
            players.some(
                player => player.role === "Informator" && player.alive
            );

        const subNote =
            document.getElementById("mafiaSubNote");

        if (mafiaAlive) {

            subNote.style.display = "none";
            subNote.textContent = "";

        } else if (informatorAlive) {

            subNote.style.display = "block";

            subNote.textContent =
                "(Mafia nie żyje - decyzję podejmuje teraz Informator.)";

        } else {

            subNote.style.display = "block";

            subNote.textContent =
                "(Mafia i Informator nie żyją - decyzję podejmuje teraz Fałszerz.)";

        }


        generateMafiaTargets();

        const currentKiller =
            players.find(p => p.role === "Mafia" && p.alive)
            || players.find(p => p.role === "Informator" && p.alive)
            || players.find(p => p.role === "Fałszerz" && p.alive);

        showBlockedNotice("mafiaAction", currentKiller);

    }

    // =========================================
    // MAFIA - LISTA CELÓW
    // =========================================
    // POPRAWKA: Mafia (i zastępujący ją Informator/Fałszerz) nie może
    // wybrać na cel żadnego ze swoich drużynowych kolegów.

    function generateMafiaTargets() {

        const select =
            document.getElementById("mafiaTarget");


        select.innerHTML = "";


        const mafia =
            players.find(
                player => player.role === "Mafia" && player.alive
            );


        players.forEach(player => {

            if (!player.alive) {
                return;
            }


            // Mafia nie zabija samej siebie

            if (mafia && player.id === mafia.id) {
                return;
            }


            // POPRAWKA: Mafia (ani zastępujący ją Informator/Fałszerz)
            // nie może zabić swoich drużynowych kolegów.

            if (player.role === "Informator" || player.role === "Fałszerz") {
                return;
            }


            const option =
                document.createElement("option");

            option.value =
                player.id;

            option.textContent =
                player.name;

            select.appendChild(option);

        });

    }

    // =========================================
    // MAFIA - ZATWIERDZENIE
    // =========================================
    // POPRAWKA: hierarchia zabójcy to Mafia -> Informator -> Fałszerz.
    // Fałszerz przejmuje zabijanie dopiero, gdy zarówno Mafia, jak
    // i Informator nie żyją. Jeśli cała trójka nie żyje, gra i tak
    // powinna była się już zakończyć wcześniej (checkWinConditions),
    // ale zostawiamy zabezpieczenie na wszelki wypadek.

    async function confirmMafiaAction() {

        const mafia =
            players.find(
                player => player.role === "Mafia" && player.alive
            );

        const informator =
            players.find(
                player => player.role === "Informator" && player.alive
            );

        const falszerz =
            players.find(
                player => player.role === "Fałszerz" && player.alive
            );

        // Kto faktycznie dokonuje wyboru tej nocy

        const actingKiller =
            mafia || informator || falszerz;


        if (!actingKiller) {

            logNightEvent(
                "🔫 Brak żyjącej Mafii, Informatora i Fałszerza - noc bez zabójstwa."
            );

            document.getElementById(
                "mafiaAction"
            ).style.display = "none";

            startHelperAction();

            return;
        }


        const select =
            document.getElementById("mafiaTarget");

        const targetId =
            parseInt(select.value);

        const target =
            players.find(player => player.id === targetId);


        if (!target) {

            alert("Wybierz osobę.");

            return;
        }


        const killerBlocked =
            game.currentNight.alcoholicBlocked === actingKiller.id;


        // Etykieta aktualnego zabójcy - do komunikatów

        const killerLabel =
            mafia
                ? "Mafia"
                : (informator ? "Informator" : "Fałszerz");


        if (killerBlocked) {

            game.currentNight.mafia = null;

            if (mafia) {

                logNightEvent(
                    "🍺 Mafia została zablokowana przez Alkoholika " +
                    "i nie mogła nikogo tej nocy zabić."
                );

            } else {

                logNightEvent(
                    "🍺 " + killerLabel + " został zablokowany przez Alkoholika " +
                    "i nie mógł nikogo tej nocy zabić."
                );

            }

        } else {

            game.currentNight.mafia =
                target.id;

            registerVisit(actingKiller.id, target.id);

            // NOWOŚĆ: Medyk działa PRZED Mafią, więc już teraz wiadomo,
            // czy Błazen faktycznie zginie. Jeśli tak i żyje Szarlatanka,
            // Mistrz Gry dostaje informację OD RAZU po wyborze celu.
            if (
                target.role === "Błazen"
                && game.currentNight.medic !== target.id
            ) {

                const szarlatankaNow = players.find(
                    p => p.role === "Szarlatanka"
                        && p.alive
                        && !p.despaired
                );

                if (szarlatankaNow) {

                    game.currentNight.despairAnnounced = true;

                    await showModalAlert(
                        "⚠️ SZARLATANKA STRACI BŁAZNA ⚠️\n\n" +
                        "Cel Mafii to Błazen (" + target.name + ") i nikt " +
                        "go nie chroni - zginie tej nocy.\n\n" +
                        "Szarlatanka (" + szarlatankaNow.name + ") zmieni " +
                        "się w ROZPACZONĄ SZARLATANKĘ. Pod koniec nocy " +
                        "podmień jej kartę. Jej nowy cel: przeżyć do " +
                        "końca gry."
                    );

                }

            }


            if (mafia) {

                logNightEvent(
                    "🔫 Mafia wybrała cel: " + target.name
                );

            } else if (informator) {

                logNightEvent(
                    "🔫 Informator (przejmując rolę zabójcy, bo Mafia " +
                    "nie żyje) wybrał cel: " + target.name
                );

            } else {

                logNightEvent(
                    "🔫 Fałszerz (przejmując rolę zabójcy, bo Mafia i " +
                    "Informator nie żyją) wybrał cel: " + target.name
                );

            }

        }


        document.getElementById(
            "mafiaAction"
        ).style.display = "none";


        startHelperAction();

    }


    // =========================================
    // INFORMATOR - ZATWIERDZENIE
    // =========================================
    // POPRAWKA: Informator zawsze wykonuje sprawdzenie dokładnej roli
    // (niezależnie od tego, czy przejął zabijanie) i - podobnie jak
    // Szaman - dostaje natychmiastowy alert z wynikiem, zamiast
    // czekać na zbiorcze podsumowanie nocy. Po niej działa teraz Fałszerz.

    function confirmInformatorAction() {

        const informator =
            players.find(
                player => player.role === "Informator" && player.alive
            );


        // Jeśli Informator nie żyje / nie występuje - pomijamy akcję

        if (!informator) {

            logNightEvent(
                "🕵️ Informator nie żyje / nie występuje - noc bez akcji Informatora."
            );

            document.getElementById(
                "helperAction"
            ).style.display = "none";

            startShamanAction();

            return;
        }


        const select =
            document.getElementById("helperTarget");

        const targetId =
            parseInt(select.value);

        const target =
            players.find(player => player.id === targetId);


        if (!target) {

            alert("Wybierz osobę.");

            return;
        }


        const informatorBlocked =
            game.currentNight.alcoholicBlocked === informator.id;


        game.currentNight.informator =
            target.id;


        if (informatorBlocked) {

            logNightEvent(
                "🍺 Informator został zablokowany przez Alkoholika " +
                "i nie mógł nikogo tej nocy sprawdzić."
            );

            alert(
                "🍺 Informator został zablokowany przez Alkoholika " +
                "i nie mógł nikogo tej nocy sprawdzić."
            );

        } else {

            // Odwiedziny rejestrujemy TYLKO gdy Informator nie jest
            // zablokowany przez Alkoholika.
            registerVisit(informator.id, target.id);

            logNightEvent(
                "🕵️ Informator sprawdził " +
                target.name +
                " - rola: " +
                getRoleLabel(target)
            );


            // POPRAWKA: Informator, tak jak Szaman, dostaje wynik
            // OD RAZU w osobnym alercie.

            alert(
                "🕵️ Informator sprawdził: " +
                target.name +
                "\n\nRola: " +
                getRoleLabel(target)
            );

        }


        document.getElementById(
            "helperAction"
        ).style.display = "none";


        startShamanAction();

    }


    // =========================================
    // OBSERWATOR - ROZPOCZĘCIE AKCJI
    // =========================================
    // Obserwator działa jako OSTATNI w kolejności nocnej.
    // Widzi kto odwiedził wskazany cel tej nocy.

    function startObserwatorAction() {

        // POPRAWKA: Obserwator nie istnieje w trybie podstawowym -
        // pomijamy go całkowicie i kończymy noc od razu po Szamanie.

        if (gameMode !== "advanced") {

            document.getElementById("shamanAction").style.display = "none";
            document.getElementById("wieszczAction").style.display = "none";
            document.getElementById("helperAction").style.display = "none";

            endNight();

            return;
        }


        document.getElementById("shamanAction").style.display = "none";
        document.getElementById("wieszczAction").style.display = "none";
        document.getElementById("helperAction").style.display = "none";

        document.getElementById(
            "obserwatorAction"
        ).style.display = "block";

        document.getElementById(
            "obserwatorInfo"
        ).textContent =
            describeRoleHolder("👁️", "Obserwator");

        generateObserwatorTargets();

        showBlockedNotice(
            "obserwatorAction",
            getRoleHolder("Obserwator")
        );

    }

    // =========================================
    // OBSERWATOR - LISTA CELÓW
    // =========================================
    // Obserwator może obserwować każdego żywego gracza
    // (włącznie z samym sobą — może obserwować swój własny dom).

    function generateObserwatorTargets() {

        const select =
            document.getElementById("obserwatorTarget");

        select.innerHTML = "";

        players.forEach(player => {

            if (!player.alive) return;

            const option = document.createElement("option");
            option.value = player.id;
            option.textContent = player.name;
            select.appendChild(option);

        });

    }

    // =========================================
    // OBSERWATOR - ZATWIERDZENIE
    // =========================================

    function confirmObserwatorAction() {

        const obserwator =
            players.find(
                p => p.role === "Obserwator" && p.alive
            );

        if (!obserwator) {

            logNightEvent(
                "👁️ Obserwator nie żyje / nie występuje - noc bez akcji Obserwatora."
            );

            document.getElementById(
                "obserwatorAction"
            ).style.display = "none";

            endNight();

            return;
        }

        const select =
            document.getElementById("obserwatorTarget");

        const targetId =
            parseInt(select.value);

        const target =
            players.find(p => p.id === targetId);

        if (!target) {

            alert("Wybierz osobę.");

            return;
        }

        game.currentNight.obserwator = targetId;

        const obserwatorBlocked =
            game.currentNight.alcoholicBlocked === obserwator.id;

        if (obserwatorBlocked) {

            logNightEvent(
                "👁️ Obserwator został zablokowany przez Alkoholika " +
                "i niczego tej nocy nie widział."
            );

            alert(
                "🍺 Obserwator został zablokowany przez Alkoholika " +
                "i niczego tej nocy nie widział."
            );

        } else {

            // Sprawdzamy kto odwiedził cel tej nocy

            const visitors =
                (game.currentNight.visits[targetId] || [])
                .map(visitorId => players.find(p => p.id === visitorId))
                .filter(Boolean);

            logNightEvent(
                "👁️ Obserwator obserwował: " + target.name
            );

            if (visitors.length === 0) {

                alert(
                    "👁️ Obserwator obserwował: " + target.name +
                    "\n\nNikt nie odwiedził tej osoby tej nocy."
                );

            } else {

                const names =
                    visitors
                        .map(v => v.name)
                        .join(", ");

                alert(
                    "👁️ Obserwator obserwował: " + target.name +
                    "\n\nOdwiedzili tę osobę tej nocy:\n" + names
                );

            }

        }

        document.getElementById(
            "obserwatorAction"
        ).style.display = "none";

        endNight();

    }


    // =========================================
    // ZAKOŃCZENIE NOCY - ROZLICZENIE
    // =========================================
    // POPRAWKA: ta funkcja wcześniej nie istniała. Rozlicza wynik
    // zabójstwa Mafii względem uzdrowienia Medyka, aktualizuje stan
    // graczy, sprawdza warunki zwycięstwa i przechodzi do kolejnego dnia.

    async function endNight() {

        const killTargetId = game.currentNight.mafia;
        const saveTargetId = game.currentNight.medic;

        // Wpisy dziennika sprzed tego miejsca to przebieg nocy (akcje
        // postaci); wpisy dodane niżej to już skutki - pokazujemy je
        // osobno, jako wynik nocy.
        const nightStepsCount = game.currentNight.log.length;

        // Wynik nocy do wielkiego nagłówka w podsumowaniu
        let nightResult = {
            tone: "neutral",
            label: "Wynik nocy",
            main: "Nikt nie zginął",
            detail: "Ta noc minęła bez ofiar."
        };

        // NOWOŚĆ: jeśli tej nocy Guślarz zostanie zaatakowany po raz
        // PIERWSZY, przeżywa (jednorazowa odporność) - ustawiamy tu
        // flagę, żeby po zbiorczym podsumowaniu nocy pokazać osobny,
        // wielki alert z pełną historią odwiedzin.
        let guslarSurvivedThisNight = null;

        // NOWOŚĆ: Szarlatanka, która straciła Błazna tej nocy
        let szarlatankaDespairedThisNight = null;


        if (killTargetId) {

            const victim =
                players.find(player => player.id === killTargetId);


            if (victim) {

                if (killTargetId === saveTargetId) {

                    // Dźwięk: Medyk uratował ofiarę
                    playSfx("medicSaveSound");

                    nightResult = {
                        tone: "safe",
                        label: "Wynik nocy",
                        main: "Nikt nie zginął",
                        detail: "🩺 " + victim.name +
                            " został uratowany przez Medyka."
                    };

                    logNightEvent(
                        "🩺 " + victim.name + " został uratowany przez Medyka!"
                    );

                    game.history.push({

                        type: "save",

                        night: game.night,

                        playerId: victim.id,

                        playerName: victim.name

                    });

                } else if (
                    victim.role === "Guślarz" &&
                    !victim.guslarAttacked
                ) {

                    // POPRAWKA: Guślarz przeżywa pierwszy atak Mafii -
                    // NIE umiera, tylko zużywa jednorazową odporność.

                    victim.guslarAttacked = true;

                    nightResult = {
                        tone: "safe",
                        label: "Wynik nocy",
                        main: "Nikt nie zginął",
                        detail: "😱 " + victim.name +
                            " (Guślarz) został zaatakowany, ale przeżył."
                    };

                    logNightEvent(
                        "😱 " + victim.name +
                        " (Guślarz) został zaatakowany przez Mafię, " +
                        "ale PRZEŻYŁ - zużył swoją jednorazową odporność!"
                    );

                    game.history.push({

                        type: "guslar_survive",

                        night: game.night,

                        playerId: victim.id,

                        playerName: victim.name

                    });

                    guslarSurvivedThisNight = victim;

                } else {

                    victim.alive = false;

                    victim.deathReason = "mafia";

                    victim.deathNight = game.night;


                    game.history.push({

                        type: "death",

                        night: game.night,

                        playerId: victim.id,

                        playerName: victim.name,

                        reason: "mafia",

                        role: victim.role

                    });


                    // Dźwięk: ktoś zginął tej nocy
                    playSfx("nightDeathSound");

                    nightResult = {
                        tone: "death",
                        label: "☠️ Tej nocy zginął",
                        main: victim.name,
                        detail: "Rola: " + getRoleLabel(victim)
                    };

                    logNightEvent(
                        "☠️ Tej nocy zginął: " +
                        victim.name +
                        " (" + victim.role + ")"
                    );

                    // NOWOŚĆ: Błazen zabity przez Mafię w nocy, a w grze
                    // jest ŻYWA Szarlatanka -> staje się Rozpaczoną
                    // Szarlatanką. Jej jedyny cel to przeżyć do końca gry.
                    if (victim.role === "Błazen") {

                        const szarlatanka = players.find(
                            p => p.role === "Szarlatanka"
                                && p.alive
                                && !p.despaired
                        );

                        if (szarlatanka) {

                            szarlatanka.despaired = true;

                            szarlatankaDespairedThisNight = szarlatanka;

                            logNightEvent(
                                "🎭💔 Szarlatanka (" + szarlatanka.name +
                                ") straciła Błazna! Mistrz Gry: podmień " +
                                "jej kartę na ROZPACZONĄ SZARLATANKĘ. " +
                                "Jej nowy cel: przeżyć do końca gry."
                            );

                            game.history.push({
                                type: "szarlatanka_despair",
                                night: game.night,
                                playerId: szarlatanka.id,
                                playerName: szarlatanka.name
                            });

                        }

                    }

                }

            }

        } else {

            logNightEvent("🌙 Ta noc minęła bez ofiar.");

        }


        // NOWOŚĆ: Błazen zginął za dnia od Rozjemcy - Szarlatanka
        // (jeśli wciąż żyje) zmienia się w Rozpaczoną tej nocy.
        const pendingSzarlatanka = players.find(
            p => p.role === "Szarlatanka"
                && p.despairPending
                && !p.despaired
        );

        if (pendingSzarlatanka) {

            pendingSzarlatanka.despairPending = false;

            if (pendingSzarlatanka.alive) {

                pendingSzarlatanka.despaired = true;

                szarlatankaDespairedThisNight = pendingSzarlatanka;

                logNightEvent(
                    "🎭💔 Szarlatanka (" + pendingSzarlatanka.name +
                    ") straciła Błazna (zastrzelonego za dnia przez " +
                    "Rozjemcę)! Mistrz Gry: podmień jej kartę na " +
                    "ROZPACZONĄ SZARLATANKĘ. Jej nowy cel: przeżyć do " +
                    "końca gry."
                );

                game.history.push({
                    type: "szarlatanka_despair",
                    night: game.night,
                    playerId: pendingSzarlatanka.id,
                    playerName: pendingSzarlatanka.name
                });

            }

        }

        updateAliveCount();

        displayPlayers();


        document.getElementById(
            "nightActions"
        ).style.display = "none";


        // =====================================
        // ZBIORCZE PODSUMOWANIE NOCY
        // =====================================

        // Przebieg nocy = akcje postaci po kolei; dodatkowe skutki
        // (np. Szarlatanka tracąca Błazna) idą do osobnych ramek.
        const nightSteps =
            game.currentNight.log.slice(0, nightStepsCount);

        const nightExtras =
            game.currentNight.log
                .slice(nightStepsCount)
                .filter(line => line.startsWith("🎭💔"));

        await showNightSummary(
            game.night,
            nightResult,
            nightSteps,
            nightExtras
        );


        // =====================================
        // GUŚLARZ - PIERWSZY ATAK (PRZEŻYCIE)
        // =====================================
        // POPRAWKA: alert z pełną historią odwiedzin pokazuje się
        // TYLKO za pierwszym razem, gdy Guślarz zostanie zaatakowany
        // (nie umiera wtedy - patrz logika wyżej). Przy drugim ataku
        // Guślarz normalnie umiera bez powtórnego alertu.

        if (guslarSurvivedThisNight) {

            // POPRAWKA: zamiast rozbicia "Noc X: Imię" (z możliwymi
            // powtórzeniami tej samej osoby z różnych nocy), pokazujemy
            // teraz zwykłą listę unikalnych osób, które kiedykolwiek
            // odwiedziły Guślarza przez całą rozgrywkę.

            const uniqueVisitorNames =
                [...new Set(
                    game.guslarVisits.map(v => v.visitorName)
                )];

            const visitSummary =
                uniqueVisitorNames.length === 0
                    ? "Nikt nie odwiedził Guślarza przez całą rozgrywkę."
                    : uniqueVisitorNames.join("\n");

            // Dźwięk: Guślarz przeżył atak - gra już w trakcie komunikatu
            await alertWithSfx("guslarSurviveSound",
                "⚠️ WSTRZYMAJ NOC ⚠️\n\n" +
                "GUŚLARZ (" + guslarSurvivedThisNight.name + ") ZOSTAŁ ZAATAKOWANY " +
                "PRZEZ MAFIĘ, ALE PRZEŻYŁ!\n\n" +
                "Powiedz graczowi, że został zaatakowany i wskaż mu kto go " +
                "odwiedzał przez całą dotychczasową rozgrywkę:\n\n" +
                visitSummary +
                "\n\nUWAGA: Guślarz umrze przy KOLEJNYM ataku Mafii."
            );

        }


        // =====================================
        // SZARLATANKA - UTRATA BŁAZNA
        // =====================================
        if (
            szarlatankaDespairedThisNight
            && !game.currentNight.despairAnnounced
        ) {

            await showModalAlert(
                "⚠️ WSTRZYMAJ NOC ⚠️\n\n" +
                "BŁAZEN NIE ŻYJE - SZARLATANKA (" +
                szarlatankaDespairedThisNight.name +
                ") STRACIŁA BŁAZNA!\n\n" +
                "Podmień jej kartę na ROZPACZONĄ SZARLATANKĘ.\n" +
                "Nowy cel: przeżyć do końca gry - tylko w ten sposób " +
                "może teraz wygrać."
            );

        }

        const gameEnded = checkWinConditions();

        if (gameEnded) {
            return;
        }


        game.day++;

        // Dzień nastaje: showDay() wyłącza muzykę nocną, a zaraz po
        // tym rozbrzmiewa dźwięk początku dnia (pianie koguta).
        showDay();

        playDayStartSound();

    }


    // =========================================
    // WARUNKI ZWYCIĘSTWA
    // =========================================
    // POPRAWKA: nowa funkcja - wcześniej gra nigdy się automatycznie
    // nie kończyła (poza specjalnym przypadkiem Błazna). Miasto
    // wygrywa, gdy nie ma już żywej Mafii. Mafia wygrywa, gdy jej
    // liczebność zrównuje się (lub przewyższa) liczbę żywych osób
    // z dobrych ról - wtedy nie da się jej już przegłosować.
    // Zwraca true, jeśli gra się zakończyła.

    function checkWinConditions() {

        const alivePlayers =
            players.filter(player => player.alive);

        // POPRAWKA: liczymy Mafię ORAZ Informatora razem - Miasto
        // nie może wygrać tylko dlatego, że zginęła "Mafia" z nazwy,
        // jeśli Informator wciąż żyje i może przejąć zabijanie.

        const aliveEvil =
            alivePlayers.filter(player => EVIL_ROLES.includes(player.role));

        // POPRAWKA: do warunku zwycięstwa Mafii liczą się WSZYSCY
        // żywi gracze spoza złej drużyny - także neutralni (Błazen,
        // Szarlatanka). Mafia wygrywa dopiero, gdy ma co najmniej tyle
        // osób, co cała reszta.
        const aliveGood =
            alivePlayers.filter(player => !EVIL_ROLES.includes(player.role));


        // NOWOŚĆ: Rozpaczona Szarlatanka wygrywa, jeśli dożyje końca gry
        // (niezależnie od tego, kto wygra).
        const despairedWinner = alivePlayers.find(
            p => p.role === "Szarlatanka" && p.despaired
        );

        const despairedNote = despairedWinner
            ? "\n\n🎭 Wygrywa również Rozpaczona Szarlatanka (" +
              despairedWinner.name + ") - przeżyła do końca gry."
            : "";

        if (aliveEvil.length === 0) {

            playSfx("townWinSound");

            showGameOver(
                "🏆 MIASTO WYGRYWA!",
                "Cała zła drużyna (Mafia i jej sojusznicy) została wyeliminowana." + despairedNote
            );

            return true;
        }


        if (aliveEvil.length >= aliveGood.length) {

            playSfx("mafiaWinSound");

            showGameOver(
                "🔫 MAFIA WYGRYWA!",
                "Mafia przejęła kontrolę nad miastem." + despairedNote
            );

            return true;
        }


        return false;

    }


    function showGameOver(title, message) {

        stopNightMusic();

        // Ukrywamy wszystkie elementy rozgrywki

        document.getElementById(
            "dayActions"
        ).style.display = "none";

        document.getElementById(
            "peacemakerAction"
        ).style.display = "none";

        document.getElementById(
            "votingAction"
        ).style.display = "none";

        document.getElementById(
            "gallowsAction"
        ).style.display = "none";

        document.getElementById(
            "nightActions"
        ).style.display = "none";


        // Ustawiamy informacje

        document.getElementById(
            "gameOverTitle"
        ).textContent = title;


        document.getElementById(
            "gameOverMessage"
        ).textContent = message;


        // Pokazujemy ekran końca

        document.getElementById(
            "gameOverScreen"
        ).style.display = "block";


        // Zatrzymujemy zegar

        clearInterval(
            game.dayTimerInterval
        );


        game.phase = "gameOver";

    }

    function newGameWithSamePlayers() {

        stopNightMusic();

        // Zachowujemy imiona

        const playerNames =
            players.map(
                player => player.name
            );


        // Tworzymy nowych graczy

        players = [];


        playerNames.forEach(
            (name, index) => {

                players.push({

                    id: index + 1,

                    name: name,

                    role: "",

                    alive: true,

                    revealed: false,

                    peacemakerUsed: false,

                    guslarAttacked: false,

                // NOWOŚĆ: Szarlatanka traci Błazna (zginął od Mafii) i
                // staje się "Rozpaczoną Szarlatanką" - nowy cel: przeżyć.
                despaired: false,

                // POPRAWKA: Medyk może uleczyć SIEBIE tylko raz w grze.
                medicSelfHealUsed: false,

                // Szarlatanka: Błazen zginął za dnia (od Rozjemcy) -
                // zmieni się w Rozpaczoną w kolejnej nocy.
                despairPending: false,

                    deathReason: null,

                    deathDay: null,

                    deathNight: null

                });

            }
        );


        // Resetujemy stan gry

        game = {

            day: 1,

            night: 0,

            phase: "day",

            dayStartedAt: null,

            dayTimerInterval: null,

            votingsLeft: 2,

            previousAlcoholicTarget: null,

            previousFalszerzTarget: null,

            currentNight: {

                alcoholic: null,
                alcoholicBlocked: null,

                medic: null,

                falszerz: null,

                shaman: null,

                wieszcz: null,

                mafia: null,

                informator: null,

                obserwator: null,

                visits: {},

                log: []

            },

            guslarVisits: [],

            history: []

        };


        // Ukrywamy ekran końca

        document.getElementById(
            "gameOverScreen"
        ).style.display = "none";


        // Generujemy formularz graczy

        generatePlayerInputs();


        // Przechodzimy do wyboru ról

        showScreen("playersScreen");

    }


    // =========================================
    // WYŚWIETLANIE WERSJI
    // =========================================
    // Wersja index.html jest wpisana na stałe w elemencie
    // #versionInfo, a script.js dopisuje własną wersję. Jeśli
    // widzisz tylko "html" bez "js" albo różne numery - któryś plik
    // nie został zaktualizowany (odśwież z Ctrl+F5).

    (function showVersion() {

        const el = document.getElementById("versionInfo");

        if (!el) return;

        const htmlVersion = el.dataset.htmlVersion || "?";

        el.textContent =
            "html v" + htmlVersion + " · js v" + APP_VERSION;

        if (htmlVersion !== APP_VERSION) {
            el.classList.add("version-mismatch");
        }

    })();
