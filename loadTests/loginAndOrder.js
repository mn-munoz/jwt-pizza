import { sleep, check, group, fail } from 'k6'
import http from 'k6/http'

export const options = {
  cloud: {
    distribution: { 'amazon:us:ashburn': { loadZone: 'amazon:us:ashburn', percent: 100 } },
    apm: [],
  },
  thresholds: {},
  scenarios: {
    Scenario_1: {
      executor: 'ramping-vus',
      gracefulStop: '30s',
      stages: [
        { target: 20, duration: '30s' },
        { target: 40, duration: '30s' },
        { target: 5, duration: '15s' },
        { target: 0, duration: '15s' },
      ],
      gracefulRampDown: '30s',
      exec: 'scenario_1',
    },
  },
}

const SERVICE = 'https://pizza-service.329devopsmmunoz.click'
const FACTORY = 'https://pizza-factory.cs329.click'
const ORIGIN = 'https://pizza.329devopsmmunoz.click'

// Stops the current iteration if the response is not 200
function expect200(response, label) {
  if (!check(response, { [`${label} status equals 200`]: (r) => r.status.toString() === '200' })) {
    console.log(response.body)
    fail(`${label} was *not* 200`)
  }
}

export function scenario_1() {
  let response
  const vars = {}

  group('Login and order - https://pizza.329devopsmmunoz.click/', function () {
    // Login
    response = http.put(`${SERVICE}/api/auth`, '{"email":"d@jwt.com","password":"diner"}', {
      headers: {
        accept: '*/*',
        'content-type': 'application/json',
        origin: ORIGIN,
      },
    })
    expect200(response, 'Login')

    // Store the token from the response
    vars.authToken = response.json().token

    // Headers shared by every authenticated request
    const authHeaders = {
      accept: '*/*',
      authorization: `Bearer ${vars.authToken}`,
      'content-type': 'application/json',
      origin: ORIGIN,
    }

    sleep(14.2)

    // Get menu
    response = http.get(`${SERVICE}/api/order/menu`, { headers: authHeaders })
    expect200(response, 'Menu')

    // Pull the pizza details from this session's menu instead of hardcoding them
    const pizza = response.json()[4]
    vars.menuId = pizza.id
    vars.title = pizza.title
    vars.price = pizza.price

    // Get franchises
    response = http.get(`${SERVICE}/api/franchise?page=0&limit=20&name=*`, { headers: authHeaders })
    expect200(response, 'Franchise')

    sleep(28.1)

    // Get current user
    response = http.get(`${SERVICE}/api/user/me`, { headers: authHeaders })
    expect200(response, 'Me')

    sleep(3)

    // Buy pizza
    response = http.post(
      `${SERVICE}/api/order`,
      JSON.stringify({
        items: [{ menuId: vars.menuId, description: vars.title, price: vars.price }],
        storeId: '1',
        franchiseId: 1,
      }),
      { headers: authHeaders }
    )
    expect200(response, 'Purchase')

    // Store the pizza JWT returned by the order
    vars.pizzaJwt = response.json().jwt

    sleep(2)

    // Verify pizza
    response = http.post(`${FACTORY}/api/order/verify`, JSON.stringify({ jwt: vars.pizzaJwt }), {
      headers: authHeaders,
    })
    expect200(response, 'Verify')
  })
}
