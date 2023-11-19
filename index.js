const DEFAULT_ANSWER_CHECKER = (a, s) => s === a;
const MAX_SUBLIST_AMOUNT = 15;

const xmlSelect = document.getElementById('xml_select');
const userInput = document.getElementById("user_input");
const questionText = document.getElementById('question');
const previousAnswer = document.getElementById('previous_answer');
const errorlessCheckbox = document.getElementById('errorless');
const subText = document.getElementById('sub');
let lowerBoundInput;
let higherBoundInput;
let questionAmountInput;

const queryModelList = async () => {
    await fetch('https://api.github.com/repos/LGatodu47/Question-Answer/contents/models?ref=master')
    .then(r => r.json())
    .then(data => {
        for(const model of data) {
            if(model.name !== undefined && model.download_url !== undefined) {
                let option = document.createElement('option')
                option.value = model.name
                option.url = model.download_url
                option.textContent = model.name
                xmlSelect.appendChild(option)
            }
        }
    })
    .catch(console.error)
}
queryModelList()

let loadedXMLFile;

let questionList;
let checker = DEFAULT_ANSWER_CHECKER;
let message = "";

let questionQueue;
let currentQuestion;
let errorless;
updateErrorless()

async function loadXMLFile() {
    let toLoad = xmlSelect.value
    if(toLoad === "none" || toLoad === loadedXMLFile) {
        return;
    }
    let option = Array.from(xmlSelect.options).find(o => o.value === toLoad)
    let req = new XMLHttpRequest();
    req.open('GET', option.url, true)
    req.onreadystatechange = () => {
        if(req.readyState === 4 && req.status === 200) {
            load(req.responseText)
            loadedXMLFile = toLoad;
        }
    }
    req.send(null)
}

function load(xml) {
    let xmlDoc = new DOMParser().parseFromString(xml, "text/xml")
    let model = xmlDoc.querySelector('model')

    if(model.hasAttribute('checker')) {
        checker = parseAnswerChecker(model.getAttribute('checker'))
    }
    if(model.hasAttribute('prompt')) {
        message = model.getAttribute('prompt')
    }
    questionList = new Array()

    for (const child of model.children) {
        let displayValue = child.hasAttribute('display') ? child.getAttribute('display') : child.tagName
        if(child.textContent !== null) {
            questionList.push([displayValue, child.textContent])
        }
    }

    if(model.hasAttribute('question_range') && questionList.length > 1) {
        let options = document.querySelector('#options')

        lowerBoundInput = document.createElement('input')
        lowerBoundInput.type = 'number'
        lowerBoundInput.id = lowerBoundInput.name = 'qrange_lower_bound'
        lowerBoundInput.min = 1
        lowerBoundInput.max = questionList.length - 1
        lowerBoundInput.value = 1
        lowerBoundInput.onchange = onQuestionBoundsChanged

        higherBoundInput = document.createElement('input')
        higherBoundInput.type = 'number'
        higherBoundInput.id = higherBoundInput.name = 'qrange_higher_bound'
        higherBoundInput.min = 2
        higherBoundInput.max = higherBoundInput.value = questionList.length
        higherBoundInput.onchange = onQuestionBoundsChanged

        let label = document.createElement('label')
        label.name = 'question_range'
        label.textContent = model.getAttribute('question_range') + ': '
        
        label.appendChild(lowerBoundInput)
        label.appendChild(higherBoundInput)
        options.appendChild(label)
    } else if(model.hasAttribute('question_limit')) {
        let options = document.querySelector('#options')
        
        let input = document.createElement('input')
        input.type = 'number'
        input.id = input.name = 'question_amount'
        input.min = 1
        input.max = input.value = questionList.length
        input.onchange = onQuestionAmountChanged
        questionAmountInput = input

        let label = document.createElement('label')
        label.name = input.name
        label.textContent = model.getAttribute('question_limit') + ": "

        label.appendChild(input)
        options.appendChild(label)
    }

    shuffleArray(questionQueue = sliceQuestionList())
    currentQuestion = questionQueue.shift()
    showQuestion();
}

function validateAnswer(answer) {
    if(!errorless || (currentQuestion !== undefined && checker(currentQuestion[1], answer))) {
        previousAnswer.textContent = currentQuestion[1]
        currentQuestion = questionQueue.shift()
        if(questionQueue.length <= 0) {
            shuffleArray(questionQueue = sliceQuestionList())
        }
        showQuestion();
    }
    lastValue = answer;
    userInput.value = "";
}

function showQuestion() {
    if(currentQuestion !== undefined) {
        questionText.textContent = message.includes('%s') ? message.replace('%s', currentQuestion[0]) : message + currentQuestion[0];
    }
}

let lastValue = ""

userInput.addEventListener('keydown', e => {
    if(e.code === "ArrowUp" && lastValue !== "") {
        userInput.value = lastValue
    }
})

userInput.addEventListener('beforeinput', e => {
    if(userInput.value !== "" && e.inputType !== null && e.inputType === "insertLineBreak") {
        validateAnswer(userInput.value)
    }
})

function parseAnswerChecker(checker) {
    const defaultAnswerChecker = (a, s) => s === a;
    if(checker === undefined || checker === null) {
        return defaultAnswerChecker;
    }
    switch(checker) {
        case 'Default': {
            return (a, s) => {
                if(a.includes('ß') && !s.includes('ß')) {
                    a = a.replace('ß', 'ss')
                }
                if(a.includes('(')) {
                    return s.includes(a.substring(0, a.indexOf('(')).trim()) && s.includes(a.substring(a.indexOf('('), a.length).trim())
                }
                return s.includes(a.trim())
            };
        }
        default: {
            return defaultAnswerChecker;
        }
    }
}

function onQuestionAmountChanged() {
    if(questionList === null || questionQueue === null) {
        return;
    }
    let questionAmount = getMaxQuestionAmount()
    if((questionAmount + 1) === questionQueue.length) {
        return;
    }
    shuffleArray(questionQueue = questionList.slice(0, questionAmount))
    currentQuestion = questionQueue.shift()
    showQuestion()
}

function onQuestionBoundsChanged() {
    if(questionList === null || questionQueue === null || lowerBoundInput === null || higherBoundInput === null) {
        return;
    }
    higherBoundInput.value = Math.min(Math.max(higherBoundInput.value, 2), questionList.length)
    lowerBoundInput.value = Math.min(Math.max(lowerBoundInput.value, 1), higherBoundInput.value - 1)
    shuffleArray(questionQueue = sliceQuestionList())
    currentQuestion = questionQueue.shift()
    showQuestion()
}

function sliceQuestionList() {
    let lowerBound = lowerBoundInput === null ? 0 : Math.max(lowerBoundInput.value - 1, 0)
    let higherBound;
    if(higherBoundInput !== null) {
        higherBound = Math.min(higherBoundInput.value, questionList.length)
    } else if(questionAmountInput !== null) {
        higherBound = Math.min(Math.max(1, questionAmountInput.value), questionList.length)
    } else {
        higherBound = questionList.length
    }
    return questionList.slice(lowerBound, higherBound)
}

function getMaxQuestionAmount() {
    if(questionAmountInput === null) {
        return questionList.length;
    }
    let questionAmount = Math.min(Math.max(1, questionAmountInput.value), questionList.length)
    if(questionAmountInput.value !== questionAmount) {
        questionAmountInput.value = questionAmount;
    }
    return questionAmount;
}

function updateErrorless() {
    errorless = errorlessCheckbox.checked;
    subText.hidden = errorless;
}

// Utilities

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}