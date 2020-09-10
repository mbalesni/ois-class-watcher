const fetch = require('node-fetch')
const player = require('play-sound')((opts = {}))
const puppeteer = require('puppeteer')
require('dotenv').config()

let token = null

async function main() {
  const checkers = [isGroupFree, isClassFree] // TODO: change this to checkers that you need

  await checkSpacesLeft(checkers)
  setInterval(() => checkSpacesLeft(checkers), 30 * 1000)
}

/* Examples of checker functions */

function isGroupFree(data) {
  const someClass = data[0] // TODO: change this to desired class
  const group = someClass.target.groups[0] // TODO: change this to desired group
  const maxSize = group.max_size
  const currentSize = group.current_size
  const spacesLeft = maxSize - currentSize
  return spacesLeft > 0
}

function isClassFree(data) {
  const someClass = data[2] // TODO: change this to desired class
  const maxStudents = someClass.target.restrictions.max_students
  const registeredStudents = someClass.target.restrictions.registered_students
  return registeredStudents < maxStudents
}

/* ***************************** */

async function getSession() {
  const LOGIN = process.env.login
  const PASSWORD = process.env.password

  const browser = await puppeteer.launch()
  const page = await browser.newPage()

  windowSet(page, 'LOGIN', LOGIN)
  windowSet(page, 'PASSWORD', PASSWORD)

  await page.goto('https://ois2.ut.ee/#/dashboard')
  await page.waitFor(2000)

  await page.click('.header__menu_button')
  await page.waitFor(2000)

  await page.$eval('input#username', (el) => (el.value = window.LOGIN))
  await page.waitFor(2000)

  await page.$eval('input#password', (el) => (el.value = window.PASSWORD))
  await page.waitFor(300)

  await page.click('button[type=submit]')
  await page.waitFor(1000)

  let sessionToken = await page.evaluate(() => {
    let session = localStorage.getItem('session_token')
    return session
  })

  await browser.close()
  return sessionToken
}

async function getData(sessionToken) {
  return fetch('https://ois2.ut.ee/api/registrations/2020/autumn', {
    headers: {
      accept: 'application/json, text/plain, */*',
      'accept-language': 'en,es;q=0.9,ru;q=0.8,uk;q=0.7',
      'cache-control': 'no-cache,no-store',
      'content-type': 'application/json',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-origin',
      'x-access-token': sessionToken,
    },
    mode: 'cors',
  })
    .then((res) => res.json())
    .then((res) => {
      return res
    })
}

function playSound(file, loop) {
  player.play(file, function (err) {
    if (err) throw err
  })
  if (loop) {
    setInterval(() => {
      player.play(file, function (err) {
        if (err) throw err
      })
    }, 2000)
  }
}

async function checkData(data, checkers) {
  if (data.status === 401) {
    token = await getSession()
    return checkSpacesLeft()
  }

  let isBingo = false

  for (let checker of checkers) {
    if (checker(data) == true) {
      isBingo = true
      console.log(checker.name, true)
    }
  }

  if (isBingo) {
    console.log(`BINGO!`)
    playSound('success.mp3')
  } else {
    console.log('No luck.')
  }
}

async function checkSpacesLeft(checkers) {
  console.log('Running checks...')

  if (!token) {
    token = await getSession()
  }

  getData(token)
    .then((data) => {
      checkData(data, checkers)
    })
    .catch((err) => {
      console.log('Error!', err)
      // in case of error, just try a 2nd time in 1s
      setTimeout(() => {
        getData(token)
          .then((data) => {
            checkData(data, checkers)
          })
          .catch((err) => {
            console.log('Error!', err)
            playSound('alarm.mp3', true)
          })
      }, 1000)
    })
}

function windowSet(page, name, value) {
  page.evaluateOnNewDocument(`
    Object.defineProperty(window, '${name}', {
      get() {
        return '${value}'
      }
    })
  `)
}

main()
