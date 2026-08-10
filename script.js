
    // =========================================
    // DOSTĘPNE ROLE
    // =========================================

    const roles = [
        "Szaman",
        "Mafia",
        "Błazen",
        "Medyk",
        "Rozjemca",
        "Wieśniak",
        "Alkoholik",
        "Informator"
    ];

    // Role "dobre" (Miasto) - używane przy sprawdzeniu Szamana
    // oraz przy ustalaniu warunków zwycięstwa.
    const GOOD_ROLES = [
        "Szaman",
        "Medyk",
        "Rozjemca",
        "Wieśniak",
        "Alkoholik"
    ];

    // NOWOŚĆ: Role "złe" / drużyna zabijająca - Mafia oraz Informator
    // (który przejmuje zabijanie po śmierci głównej Mafii). Używane
    // przy ustalaniu warunków zwycięstwa - Miasto nie może wygrać
    // dopóki którakolwiek z tych ról jeszcze żyje. Błazen jest
    // rolą neutralną i ma własny, osobny warunek zwycięstwa
    // (zostać wygłosowanym), więc celowo nie jest tu uwzględniony.
    const EVIL_ROLES = [
        "Mafia",
        "Informator"
    ];


    // =========================================
    // TABLICA GRACZY
    // =========================================

    let players = [];

    // =========================================
    // STAN GRY
    // =========================================

    let game = {

        day: 1,

        night: 0,

        phase: "day",

        dayStartedAt: null,
        dayTimerInterval: null,

        previousAlcoholicTarget: null,

        currentNight: {

            alcoholic: null,
            alcoholicBlocked: null,

            medic: null,

            shaman: null,

            mafia: null,

            informator: null,

            log: []

        },

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
    // INFORMACJA O POSIADACZU ROLI
    // =========================================
    // POPRAWKA: nowa funkcja pomocnicza - zwraca gracza mającego
    // daną rolę niezależnie od tego, czy żyje czy nie. Używana do
    // wyświetlania "kto jest daną rolą i czy żyje" na każdym
    // panelu akcji nocnej.

    function getRoleHolder(roleName) {

        return players.find(player => player.role === roleName);

    }

    function describeRoleHolder(icon, roleName) {

        const holder = getRoleHolder(roleName);

        if (!holder) {

            return icon + " Rola „" + roleName + "” nie występuje w tej rozgrywce.";

        }

        const status = holder.alive ? "żyje" : "nie żyje";

        return icon + " " + roleName + ": " + holder.name + " (" + status + ")";

    }

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


    function confirmPeacemakerAction() {

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


        // Czy cel był dobry?

        const targetWasGood =
            isGoodRole(target.role);


        // Jeżeli dobry → Rozjemca również umiera

        if (targetWasGood) {

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


            alert(

                "💥 Rozjemca " +
                peacemaker.name +
                " zastrzelił dobrą osobę!\n\n" +

                target.name +
                " umiera.\n" +

                "Rozjemca również umiera."

            );

        }

        else {

            alert(

                "⚔️ Rozjemca zastrzelił " +
                target.name +
                ".\n\n" +

                target.name +
                " umiera."

            );

        }


        document.getElementById(
            "peacemakerAction"
        ).style.display = "none";


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

    function confirmVoting() {

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


        // =====================================
        // POTWIERDZENIE
        // =====================================

        const confirmed =
            confirm(
                "Czy na pewno " +
                target.name +
                " został wygłosowany?"
            );


        if (!confirmed) {
            return;
        }


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
            "votingAction"
        ).style.display = "none";


        updateAliveCount();

        displayPlayers();


        // =====================================
        // BŁAZEN
        // =====================================

        if (target.role === "Błazen") {

            showGameOver(

                "🤡 BŁAZEN WYGRYWA!",

                target.name +
                " został wygłosowany i spełnił swój cel."

            );

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

        alert(

            "☠️ " +
            target.name +
            " został wygłosowany."

        );

    }


    // =========================================
    // ANULOWANIE GŁOSOWANIA
    // =========================================

    function cancelVoting() {

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

        showScreen("newGameScreen");

    }


    // =========================================
    // TWORZENIE LISTY GRACZY
    // =========================================

    function createPlayers() {

        const playerCount =
            parseInt(document.getElementById("playerCount").value);


        if (playerCount < 4 || playerCount > 8) {

            alert("Liczba graczy musi wynosić od 4 do 8.");

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

            roles.forEach(role => {

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


        // Resetujemy stan rozgrywki

        game.day = 1;
        game.night = 0;
        game.phase = "day";
        game.history = [];
        game.previousAlcoholicTarget = null;


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
                player.role;


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

    }

    // =========================================
    // DZIEŃ
    // =========================================

    function showDay() {

        game.phase = "day";

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

        // Czyścimy akcje poprzedniej nocy
        game.currentNight = {

            alcoholic: null,
            alcoholicBlocked: null,
            medic: null,
            shaman: null,
            mafia: null,
            informator: null,
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
        document.getElementById("alcoholicAction").style.display = "none";
        document.getElementById("medicAction").style.display = "none";
        document.getElementById("shamanAction").style.display = "none";
        document.getElementById("informatorAction").style.display = "none";
        document.getElementById("mafiaAction").style.display = "none";


        // Pokazujemy panel nocy (i zostawiamy go widocznym przez
        // całą noc - poszczególne pod-panele są jego rodzeństwem
        // wewnętrznym i przełączają się nawzajem)

        document.getElementById(
            "nightActions"
        ).style.display = "block";


        updateAliveCount();

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
            describeRoleHolder("🩺", "Medyk");


        generateMedicTargets();

    }

    // =========================================
    // MEDYK - LISTA CELÓW
    // =========================================

    function generateMedicTargets() {

        const select =
            document.getElementById("medicTarget");


        select.innerHTML = "";


        players.forEach(player => {

            // Medyk może leczyć tylko żywych

            if (!player.alive) {
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

            startShamanAction();

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

            logNightEvent(
                "🩺 Medyk postanowił uleczyć: " + target.name
            );

        }


        // Następna rola: Szaman

        startShamanAction();

    }

    // =========================================
    // SZAMAN - ROZPOCZĘCIE AKCJI
    // =========================================

    function startShamanAction() {

        document.getElementById(
            "medicAction"
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

            startMafiaAction();

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

        } else {

            // Ustalamy frakcję celu

            const isGood =
                isGoodRole(target.role);


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


        // Następna rola: Mafia

        startMafiaAction();

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
            "shamanAction"
        ).style.display = "none";


        document.getElementById(
            "mafiaAction"
        ).style.display = "block";


        document.getElementById(
            "mafiaInfo"
        ).textContent =
            describeRoleHolder("🔫", "Mafia");


        const mafiaAlive =
            players.some(
                player => player.role === "Mafia" && player.alive
            );

        const subNote =
            document.getElementById("mafiaSubNote");

        if (mafiaAlive) {

            subNote.style.display = "none";
            subNote.textContent = "";

        } else {

            subNote.style.display = "block";

            subNote.textContent =
                "(Mafia nie żyje - decyzję podejmuje teraz Informator.)";

        }


        generateMafiaTargets();

    }

    // =========================================
    // MAFIA - LISTA CELÓW
    // =========================================
    // POPRAWKA: Mafia (i zastępujący ją Informator) nie może wybrać
    // na cel Informatora - to jego drużynowy kolega, jest chroniony.

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


            // POPRAWKA: Mafia (ani zastępujący ją Informator) nie
            // może zabić Informatora - to jej drużynowy kolega.

            if (player.role === "Informator") {
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
    // POPRAWKA: panel nie jest już pomijany, gdy Mafia nie żyje -
    // zamiast tego uznajemy Informatora za faktycznie działającego
    // (blokada Alkoholika sprawdzana jest wtedy względem NIEGO).
    // Jeśli zarówno Mafia, jak i Informator nie żyją, gra i tak
    // powinna była się już zakończyć wcześniej (checkWinConditions),
    // ale zostawiamy zabezpieczenie na wszelki wypadek.

    function confirmMafiaAction() {

        const mafia =
            players.find(
                player => player.role === "Mafia" && player.alive
            );

        const informator =
            players.find(
                player => player.role === "Informator" && player.alive
            );

        // Kto faktycznie dokonuje wyboru tej nocy

        const actingKiller =
            mafia || informator;


        if (!actingKiller) {

            logNightEvent(
                "🔫 Brak żyjącej Mafii i Informatora - noc bez zabójstwa."
            );

            document.getElementById(
                "mafiaAction"
            ).style.display = "none";

            startInformatorAction();

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


        if (killerBlocked) {

            game.currentNight.mafia = null;

            logNightEvent(

                (mafia ? "🍺 Mafia" : "🍺 Informator") +
                " została/został zablokowana/y przez Alkoholika " +
                "i nie mogła/mógł nikogo tej nocy zabić."

            );

        } else {

            game.currentNight.mafia =
                target.id;

            if (mafia) {

                logNightEvent(
                    "🔫 Mafia wybrała cel: " + target.name
                );

            } else {

                logNightEvent(
                    "🔫 Informator (przejmując rolę zabójcy, bo Mafia " +
                    "nie żyje) wybrał cel: " + target.name
                );

            }

        }


        document.getElementById(
            "mafiaAction"
        ).style.display = "none";


        startInformatorAction();

    }


    // =========================================
    // INFORMATOR - ROZPOCZĘCIE AKCJI
    // =========================================
    // POPRAWKA: Informator działa teraz PO Mafii i ZAWSZE sprawdza
    // dokładną rolę wskazanej osoby - nawet jeśli tej samej nocy
    // (w panelu Mafii, wcześniej) przejął już zabijanie. Nie traci
    // umiejętności sprawdzania.

    function startInformatorAction() {

        document.getElementById(
            "mafiaAction"
        ).style.display = "none";


        document.getElementById(
            "informatorAction"
        ).style.display = "block";


        document.getElementById(
            "informatorInfo"
        ).textContent =
            describeRoleHolder("🕵️", "Informator");


        document.getElementById(
            "informatorModeLabel"
        ).textContent =
            "Wybierz osobę, której dokładną rolę chcesz poznać.";


        generateInformatorTargets();

    }

    // =========================================
    // INFORMATOR - LISTA CELÓW
    // =========================================
    // POPRAWKA: Informator nie może wybrać swojego kolegi z Mafii
    // (oprócz tego, że nadal nie może wybrać samego siebie).

    function generateInformatorTargets() {

        const select =
            document.getElementById("informatorTarget");


        select.innerHTML = "";


        const informator =
            players.find(
                player => player.role === "Informator" && player.alive
            );


        players.forEach(player => {

            if (!player.alive) {
                return;
            }


            // Informator nie sprawdza samego siebie

            if (informator && player.id === informator.id) {
                return;
            }


            // POPRAWKA: Informator nie może wybrać swojego kolegi z Mafii

            if (player.role === "Mafia") {
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
    // INFORMATOR - ZATWIERDZENIE
    // =========================================
    // POPRAWKA: Informator zawsze wykonuje sprawdzenie dokładnej roli
    // (niezależnie od tego, czy przejął zabijanie) i - podobnie jak
    // Szaman - dostaje natychmiastowy alert z wynikiem, zamiast
    // czekać na zbiorcze podsumowanie nocy. To ostatnia akcja nocna,
    // więc kończymy noc od razu po niej.

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
                "informatorAction"
            ).style.display = "none";

            endNight();

            return;
        }


        const select =
            document.getElementById("informatorTarget");

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

        } else {

            logNightEvent(
                "🕵️ Informator sprawdził " +
                target.name +
                " - rola: " +
                target.role
            );


            // POPRAWKA: Informator, tak jak Szaman, dostaje wynik
            // OD RAZU w osobnym alercie.

            alert(
                "🕵️ Informator sprawdził: " +
                target.name +
                "\n\nRola: " +
                target.role
            );

        }


        document.getElementById(
            "informatorAction"
        ).style.display = "none";


        endNight();

    }


    // =========================================
    // ZAKOŃCZENIE NOCY - ROZLICZENIE
    // =========================================
    // POPRAWKA: ta funkcja wcześniej nie istniała. Rozlicza wynik
    // zabójstwa Mafii względem uzdrowienia Medyka, aktualizuje stan
    // graczy, sprawdza warunki zwycięstwa i przechodzi do kolejnego dnia.

    function endNight() {

        const killTargetId = game.currentNight.mafia;
        const saveTargetId = game.currentNight.medic;


        if (killTargetId) {

            const victim =
                players.find(player => player.id === killTargetId);


            if (victim) {

                if (killTargetId === saveTargetId) {

                    logNightEvent(
                        "🩺 " + victim.name + " został uratowany przez Medyka!"
                    );

                    game.history.push({

                        type: "save",

                        night: game.night,

                        playerId: victim.id,

                        playerName: victim.name

                    });

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


                    logNightEvent(
                        "☠️ Tej nocy zginął: " +
                        victim.name +
                        " (" + victim.role + ")"
                    );

                }

            }

        } else {

            logNightEvent("🌙 Ta noc minęła bez ofiar.");

        }


        updateAliveCount();

        displayPlayers();


        document.getElementById(
            "nightActions"
        ).style.display = "none";


        // =====================================
        // ZBIORCZE PODSUMOWANIE NOCY
        // =====================================
        // POPRAWKA: zamiast osobnych alertów po każdej akcji,
        // pokazujemy teraz jedno podsumowanie wszystkiego, co
        // wydarzyło się tej nocy.

        const summary =
            "🌙 Podsumowanie nocy " + game.night + ":\n\n" +
            game.currentNight.log.join("\n");

        alert(summary);


        const gameEnded = checkWinConditions();

        if (gameEnded) {
            return;
        }


        game.day++;

        showDay();

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

        const aliveGood =
            alivePlayers.filter(player => isGoodRole(player.role));


        if (aliveEvil.length === 0) {

            showGameOver(
                "🏆 MIASTO WYGRYWA!",
                "Cała Mafia (wraz z Informatorem) została wyeliminowana."
            );

            return true;
        }


        if (aliveEvil.length >= aliveGood.length) {

            showGameOver(
                "🔫 MAFIA WYGRYWA!",
                "Mafia przejęła kontrolę nad miastem."
            );

            return true;
        }


        return false;

    }


    // =========================================
    // ROZJEMCA UJAWNIŁ ROLĘ
    // =========================================

    function revealedRole() {

        game.history.push({

            type: "day_event",

            day: game.day,

            description:
                "Rozjemca ujawnił swoją rolę."

        });

        alert("Zapisano ujawnienie roli Rozjemcy.");

    }

    function showGameOver(title, message) {

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

            previousAlcoholicTarget: null,

            currentNight: {

                alcoholic: null,
                alcoholicBlocked: null,

                medic: null,

                shaman: null,

                mafia: null,

                informator: null,

                log: []

            },

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
