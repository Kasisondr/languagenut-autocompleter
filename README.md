# Lume: A Free Languagenut Autocompleter

A Tampermonkey script that automates homework.

It does not use any AI to fetch answers—it relies directly on API calls. This is designed to remain completely undetected by standard monitoring.

---

## Features
* Automation
* Fake Time
* Webhook Support

## Supported Games
* Jumble
* Multiple Choice Listening
* Multiple Choice Reading
* WordPod (Listening + Reading)
* WordPop (Listening + Reading)
* Gap Fill
* Sentence Building
* Fridge Magnets
* Verb Matcher
* Jigsaw
* Forklift
* Ocean Cleaner
* Skyrise
* Concert Speaking
* Avocado Smash (Some parts)
* Code Breaker
* Blast Off (I think)
* Matching Pairs
* Exams

---

## Working On

* Phonics Band
* Guacamole
* Phonics Imposter
* Phonics Catapult
* Racing
* *More to come...*

---

## How It Works

Most games pull answers directly from LanguageNut’s own APIs, primarily:

* `getVocabTranslations`
* `getSentenceTranslations`
* `getVerbTranslations`

The script intercepts and reads the output from these endpoints, which is where the correct answers are derived from.

---

## Special Exploits

### Concert Speaking Game
There is an exploit implemented in `concert.js` that alters the API calls for the Concert Speaking game to return correct parameters automatically. 

**How to use it:**
1. Paste the exploit code from `concert.js` into your browser's Developer Tools console.
2. Press the microphone button to "speak."
3. The interface will instantly show a completed score (e.g., 15/15).
