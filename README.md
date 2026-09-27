Lume: A Free Languagenut Autocompleter.
A Tampermonkey script that automates homework.

It does not use any ai to fetch the answer, it relies on api calls,
This is never going to be detected!

It can do:
  Jumble
  Multiple Choice Listening
  Multiple Choice Reading
  Multiple Choice 2 / MC3 – Listening
  Multiple Choice 2 / MC3 – Reading
  WordPod Reading
  WordPod Listening
  WordPop Listening
  Gap Fill
  Sentence Building / Fridge Magnets
  Verb Matcher
  Jigsaw
  Forklift
  Ocean Cleaner
  Skyrise
  Concert Speaking — currently experimental; this is the one we’re still debugging because its mic interaction is weird.
  Avocado Smash(Some parts)
  Code Breaker
  Blast Off(I think)
  Matching Pairs
  
Working on:
  Exams
  Skyrise Speaking
  Sentence Building Listening
  Phonics Band (PhonicsBand)
  Guacamole (PhonicsGuacamole)
  Phonics Imposter (PhonicsImposter)
  Phonics Catapult (PhonicsCatapult). Phonics/pronunciation is still an active part of LanguageNut, but these will probably need audio/sound-to-answer mapping rather than just text matching.

How the script gets the answers without AI:
   Most games pull answers directly from LanguageNut’s own APIs, mainly:
   getVocabTranslations, getSentenceTranslations, and getVerbTranslations so the script reads the output from the script and thats is what the answer usually comes from.

There is an exploit that I found that changes the api calls for the Concert Speaking Game to make the answers correct, you paste this into dev tools and press the mic button to "speak", it is found inside of concert.js
