// ==UserScript==
// @name         JVC - Anticensure Automatique
// @namespace    https://github.com/moyaona
// @version      1.0
// @description  Détecte et remplace les mots censurés automatiquement par JVC.
// @author       moyaona
// @match        https://www.jeuxvideo.com/forums/*
// @connect      jvflux.fr
// @grant        GM_xmlhttpRequest
// @run-at       document-end
// @icon         https://image.noelshack.com/fichiers/2025/34/5/1755818593-logo-jvcanticensure.png
// ==/UserScript==

(function() {
    'use strict';

    // Affiche un message dans la console (F12) pour confirmer que le script est bien lancé.
    console.log('[JVC Avertisseur] Le script se lance !');

    // --- VARIABLES GLOBALES DU SCRIPT ---

    // Tableau qui contiendra la liste des mots censurés une fois récupérée.
    let censoredWords = [];

    // Drapeau de sécurité pour éviter que le script ne s'analyse lui-même en boucle.
    // Quand il est `true`, le clic sur "Poster" est autorisé sans analyse.
    let isSafeToSubmit = false;

    // --- FONCTIONS DU SCRIPT ---

    /**
     * Met à jour la valeur de la zone de texte d'une manière qui force le framework
     * du site (comme React) à reconnaître le changement.
     * Une simple modification `textarea.value = ...` n'est souvent pas suffisante sur les sites modernes.
     *
     * @param {HTMLTextAreaElement} textarea - L'élément de la zone de texte à modifier.
     * @param {string} value - Le nouveau texte à insérer dans la zone.
     */
    function setReactTextareaValue(textarea, value) {
        // Récupère la fonction native du navigateur pour définir la valeur d'un élément.
        const nativeTextareaValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
        // Appelle cette fonction native sur notre zone de texte pour changer sa valeur à un bas niveau.
        nativeTextareaValueSetter.call(textarea, value);
        // Déclenche un événement "input" pour simuler une saisie utilisateur, ce qui force
        // le framework du site à enregistrer et à accepter la nouvelle valeur.
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }

    /**
     * C'est la fonction principale, exécutée à chaque fois que l'utilisateur clique sur le bouton "Poster".
     * Elle analyse le message, gère la pop-up et le remplacement des mots.
     *
     * @param {MouseEvent} event - L'objet de l'événement du clic, qui nous permet de le contrôler (l'annuler, etc.).
     */
    function handleClick(event) {
        // Si le drapeau de sécurité est activé, cela signifie que c'est notre propre script qui a
        // re-cliqué sur le bouton. On autorise l'envoi et on réinitialise le drapeau.
        if (isSafeToSubmit) {
            console.log('[JVC Avertisseur] Envoi autorisé, le script se retire.');
            isSafeToSubmit = false; // Réinitialisation pour le prochain message de l'utilisateur.
            return;
        }

        // Cible la zone de texte (soit pour un nouveau sujet, soit pour une réponse).
        const textarea = document.querySelector('#message_topic, #message_poste');
        // Si la zone de texte n'existe pas ou est vide, on ne fait rien.
        if (!textarea || !textarea.value) {
            return;
        }

        console.log('[JVC Avertisseur] Clic détecté, analyse du message...');
        const messageContent = textarea.value;

        // On utilise un `Set` pour stocker les mots censurés trouvés.
        // Un `Set` évite automatiquement les doublons si un mot apparaît plusieurs fois.
        const foundWords = new Set();

        // On parcourt TOUTE la liste des mots censurés.
        for (const word of censoredWords) {
            // On crée une expression régulière pour trouver le mot exact, insensible à la casse.
            // `\b` assure que l'on ne détecte pas "ion" dans "nation", par exemple.
            const regex = new RegExp('\\b' + word.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '\\b', 'i');
            if (regex.test(messageContent)) {
                foundWords.add(word); // On ajoute chaque mot trouvé au Set.
            }
        }
        // La boucle continue jusqu'au bout pour trouver tous les mots, contrairement aux versions précédentes.

        // On n'agit que si au moins un mot a été trouvé.
        if (foundWords.size > 0) {
            console.log(`[JVC Avertisseur] Mots censurés trouvés :`, foundWords);

            // On bloque l'action par défaut du clic pour empêcher l'envoi du message original.
            event.preventDefault();
            event.stopImmediatePropagation(); // Version plus forte pour bloquer d'autres scripts éventuels.

            // On construit dynamiquement le message de la pop-up.
            let confirmationMessage = "Les mots suivants sont susceptibles d'être censurés sur JVC :\n\n";
            foundWords.forEach(word => {
                const replacement = word.split('').join(' ');
                confirmationMessage += `• "${word}" sera remplacé par "${replacement}"\n`;
            });
            confirmationMessage += "\nVoulez-vous effectuer tous ces remplacements et envoyer le message ?";

            // On affiche la pop-up de confirmation.
            if (window.confirm(confirmationMessage)) {
                // Si l'utilisateur clique sur "OK" :
                let newText = messageContent;

                // On parcourt la liste des mots trouvés et on les remplace tous dans le texte.
                foundWords.forEach(word => {
                    const replacement = word.split('').join(' ');
                    const globalRegex = new RegExp('\\b' + word.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '\\b', 'gi');
                    newText = newText.replace(globalRegex, replacement);
                });

                // On met à jour la zone de texte avec la méthode spéciale compatible avec React.
                setReactTextareaValue(textarea, newText);

                // On active le drapeau de sécurité pour que le prochain clic soit autorisé.
                isSafeToSubmit = true;

                console.log('[JVC Avertisseur] Remplacements effectués. On redéclenche le clic...');
                // On simule un nouveau clic sur le bouton pour que le script de JVC envoie le message corrigé.
                event.currentTarget.click();
            } else {
                // Si l'utilisateur clique sur "Annuler", on ne fait rien.
                console.log('[JVC Avertisseur] Remplacement annulé par l\'utilisateur.');
            }
        } else {
            // Si aucun mot n'a été trouvé, on laisse l'envoi se faire normalement.
            console.log('[JVC Avertisseur] Aucun mot censuré. Envoi normal.');
        }
    }

    /**
     * Attend que le bouton "Poster" soit présent sur la page avant d'y attacher notre fonction `handleClick`.
     * C'est nécessaire car les pages modernes chargent souvent leur contenu de manière dynamique.
     */
    function waitForButtonAndAttachListener() {
        console.log('[JVC Avertisseur] En attente du bouton "Poster"...');
        const interval = setInterval(() => {
            const postButton = document.querySelector('.postMessage');
            if (postButton) {
                // Une fois le bouton trouvé, on arrête de le chercher.
                clearInterval(interval);
                console.log('[JVC Avertisseur] Bouton "Poster" trouvé ! Attachement de l\'écouteur de CLIC.');
                // On attache notre fonction `handleClick` à l'événement 'click' du bouton.
                postButton.addEventListener('click', handleClick, true);
            }
        }, 500); // Vérification toutes les 500 millisecondes.
    }

    /**
     * Récupère de manière asynchrone la liste des mots censurés depuis le site externe jvflux.fr.
     * C'est la première fonction à être appelée.
     */
    function fetchCensoredWords() {
        console.log('[JVC Avertisseur] Tentative de récupération de la liste des mots...');
        // Utilise une fonction spéciale de Tampermonkey pour les requêtes inter-domaines.
        GM_xmlhttpRequest({
            method: "GET",
            url: "https://jvflux.fr/Erreur_500",
            onload: function(response) {
                // Si la requête réussit :
                if (response.status >= 200 && response.status < 400) {
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(response.responseText, "text/html");
                    const listHeader = doc.querySelector("#Liste");

                    if (listHeader && listHeader.parentElement && listHeader.parentElement.nextElementSibling) {
                        const ul = listHeader.parentElement.nextElementSibling;
                        if (ul && ul.tagName === 'UL') {
                            const items = ul.querySelectorAll("li");
                            // Pour chaque ligne de la liste :
                            items.forEach(li => {
                                // 1. On retire les commentaires entre parenthèses.
                                let text = li.textContent.replace(/\s*\(.*\)/, '').trim();
                                // 2. On sépare les mots liés par un "/" ou une ",".
                                const words = text.split(/[\/,]/);
                                // 3. On ajoute chaque mot nettoyé à notre tableau global.
                                words.forEach(word => {
                                    const cleanedWord = word.trim().toLowerCase();
                                    if (cleanedWord) censoredWords.push(cleanedWord);
                                });
                            });
                            console.log(`[JVC Avertisseur] Liste des mots chargée (${censoredWords.length} mots).`);
                            // Ce n'est qu'une fois la liste chargée que l'on commence à surveiller la page.
                            waitForButtonAndAttachListener();
                        }
                    } else { console.error('[JVC Avertisseur] Impossible de trouver la liste sur la page JVFlux.'); }
                } else { console.error('[JVC Avertisseur] Erreur de récupération de la liste. Statut:', response.status); }
            },
            onerror: function(error) { console.error('[JVC Avertisseur] Erreur réseau:', error); }
        });
    }

    // --- POINT D'ENTRÉE DU SCRIPT ---
    // La première et unique action lancée au démarrage est de récupérer la liste de mots.
    // Le reste des actions (attendre le bouton, etc.) sera déclenché en cascade depuis cette fonction.
    fetchCensoredWords();

})();