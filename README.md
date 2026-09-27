Lume: A Free Languagenut Autocompleter.
A Tampermonkey script that automates homework.

It does not use any ai to fetch the answer, it relies on api calls,
This is never going to be detected!

It can do:
  Jumble
  Multiple Choice Listening
  Multiple Choice Reading
  WordPod (Listening + Reading)
  WordPop (Listening + Reading)
  Gap Fill
  Sentence Building
  Fridge Magnets
  Verb Matcher
  Jigsaw
  Forklift
  Ocean Cleaner
  Skyrise
  Concert Speaking
  Avocado Smash(Some parts)
  Code Breaker
  Blast Off(I think)
  Matching Pairs
  Exams
  Sentence Building
  
Working on:
  Phonics Band 
  Guacamole 
  Phonics Imposter 
  Phonics Catapult 
  Racing
  More to come...
  
How the script gets the answers without AI:
   Most games pull answers directly from LanguageNut’s own APIs, mainly:
   getVocabTranslations, getSentenceTranslations, and getVerbTranslations so the script reads the output from the script and thats is what the answer usually comes from.

There is an exploit that I made that changes the api calls for the Concert Speaking Game to make the answers correct, you paste this into dev tools and press the mic button to "speak", it is found inside of concert.js
It shows as 15/15 (or whatever value it is)
