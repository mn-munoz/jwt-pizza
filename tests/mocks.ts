import { Page } from '@playwright/test';
import { expect } from './testSetup';
import { Endpoint, Franchise, Menu, Order, Role, Store, User } from '../src/service/pizzaService';

// ---------- Test data ----------

export type TestUser = User & { email: string; password: string; initials: string };

export const users = {
  diner: { id: '3', name: 'Kai Chen', initials: 'KC', email: 'd@jwt.com', password: 'a', roles: [{ role: Role.Diner }] },
  admin: { id: '1', name: 'Ada Admin', initials: 'AA', email: 'a@jwt.com', password: 'admin', roles: [{ role: Role.Admin }] },
  franchisee: {
    id: '4',
    name: 'pizza franchisee',
    initials: 'pf',
    email: 'f@jwt.com',
    password: 'franchisee',
    roles: [{ role: Role.Diner }, { role: Role.Franchisee, objectId: '2' }],
  },
} satisfies Record<string, TestUser>;

export const menu: Menu = [
  { id: '1', title: 'Veggie', image: 'pizza1.png', price: 0.0038, description: 'A garden of delight' },
  { id: '2', title: 'Pepperoni', image: 'pizza2.png', price: 0.0042, description: 'Spicy treat' },
];

export const stores = {
  lehi: { id: '4', name: 'Lehi' },
  springville: { id: '5', name: 'Springville' },
  americanFork: { id: '6', name: 'American Fork' },
  spanishFork: { id: '7', name: 'Spanish Fork' },
} satisfies Record<string, Store>;

export const franchises = {
  lotaPizza: {
    id: '2',
    name: 'LotaPizza',
    admins: [{ id: users.franchisee.id, name: users.franchisee.name, email: users.franchisee.email }],
    stores: [stores.lehi, stores.springville, stores.americanFork],
  },
  pizzaCorp: { id: '3', name: 'PizzaCorp', stores: [stores.spanishFork] },
  topSpot: { id: '4', name: 'topSpot', stores: [] },
} satisfies Record<string, Franchise>;

// Only the diner has ordered before
export const pastOrders: Order[] = [
  {
    id: '11',
    franchiseId: franchises.lotaPizza.id,
    storeId: stores.lehi.id,
    date: '2026-09-15T18:30:00.000Z',
    items: [
      { menuId: '1', description: 'Veggie', price: 0.0038 },
      { menuId: '2', description: 'Pepperoni', price: 0.0042 },
    ],
  },
];

export const authToken = 'abcdef';
export const orderJwt = 'eyJpYXQ';

// ---------- Mocked backend ----------

// What the mocked backend remembers during one test
interface MockState {
  users: Record<string, User>;
  franchises: Franchise[];
  loggedInUser?: User;
}

function withoutTestFields({ password, initials, ...user }: User & { initials?: string }): User {
  return user;
}

export async function mockAuth(page: Page, state: MockState) {
  await page.route('*/**/api/auth', async (route) => {
    const method = route.request().method();
    if (method === 'DELETE') {
      state.loggedInUser = undefined;
      await route.fulfill({ json: { message: 'logout successful' } });
      return;
    }

    if (method === 'POST') {
      const registerReq = route.request().postDataJSON();
      if (state.users[registerReq.email]) {
        await route.fulfill({ status: 409, json: { message: 'user already exists' } });
        return;
      }
      state.users[registerReq.email] = { id: '5', name: registerReq.name, email: registerReq.email, password: registerReq.password, roles: [{ role: Role.Diner }] };
      state.loggedInUser = withoutTestFields(state.users[registerReq.email]);
      await route.fulfill({ json: { user: state.loggedInUser, token: authToken } });
      return;
    }

    expect(method).toBe('PUT');
    const loginReq = route.request().postDataJSON();
    const user = state.users[loginReq.email];
    if (!user || user.password !== loginReq.password) {
      await route.fulfill({ status: 401, json: { error: 'Unauthorized' } });
      return;
    }
    state.loggedInUser = withoutTestFields(user);
    await route.fulfill({ json: { user: state.loggedInUser, token: authToken } });
  });

  await page.route('*/**/api/user/me', async (route) => {
    expect(route.request().method()).toBe('GET');
    await route.fulfill({ json: state.loggedInUser });
  });
}

export async function mockMenu(page: Page) {
  await page.route('*/**/api/order/menu', async (route) => {
    expect(route.request().method()).toBe('GET');
    await route.fulfill({ json: menu });
  });
}

export async function mockFranchises(page: Page, state: MockState) {
  await page.route(/\/api\/franchise(\?.*)?$/, async (route) => {
    const method = route.request().method();
    if (method === 'POST') {
      const franchiseReq = route.request().postDataJSON();
      const franchiseRes: Franchise = {
        ...franchiseReq,
        id: '5',
        admins: franchiseReq.admins.map((admin: { email: string }) => ({ ...admin, id: users.franchisee.id, name: users.franchisee.name })),
        stores: [],
      };
      state.franchises.push(franchiseRes);
      await route.fulfill({ json: franchiseRes });
      return;
    }

    expect(method).toBe('GET');
    // Same name filter as the service: '*' is a wildcard
    const nameFilter = new URL(route.request().url()).searchParams.get('name') ?? '*';
    const nameRegex = new RegExp(`^${nameFilter.split('*').join('.*')}$`, 'i');
    await route.fulfill({ json: { franchises: state.franchises.filter((franchise) => nameRegex.test(franchise.name)), more: false } });
  });

  await page.route(/\/api\/franchise\/\d+$/, async (route) => {
    const method = route.request().method();
    const id = route.request().url().split('/').pop();
    if (method === 'GET') {
      // The id is a user id here: return the franchises that user administers
      await route.fulfill({ json: state.franchises.filter((franchise) => franchise.admins?.some((admin) => admin.id === id)) });
      return;
    }

    expect(method).toBe('DELETE');
    state.franchises = state.franchises.filter((franchise) => franchise.id !== id);
    await route.fulfill({ json: { message: 'franchise deleted' } });
  });

  await page.route(/\/api\/franchise\/\d+\/store$/, async (route) => {
    expect(route.request().method()).toBe('POST');
    const [, franchiseId] = route.request().url().match(/\/franchise\/(\d+)\/store$/)!;
    const store: Store = { id: '8', name: route.request().postDataJSON().name };
    state.franchises.find((franchise) => franchise.id === franchiseId)?.stores.push(store);
    await route.fulfill({ json: { ...store, franchiseId } });
  });

  await page.route(/\/api\/franchise\/\d+\/store\/\d+$/, async (route) => {
    expect(route.request().method()).toBe('DELETE');
    const [, franchiseId, storeId] = route.request().url().match(/\/franchise\/(\d+)\/store\/(\d+)$/)!;
    const franchise = state.franchises.find((f) => f.id === franchiseId);
    if (franchise) franchise.stores = franchise.stores.filter((store) => store.id !== storeId);
    await route.fulfill({ json: { message: 'store deleted' } });
  });
}

export async function mockOrders(page: Page, state: MockState) {
  await page.route('*/**/api/order', async (route) => {
    if (route.request().method() === 'GET') {
      const orders = state.loggedInUser?.id === users.diner.id ? pastOrders : [];
      await route.fulfill({ json: { dinerId: state.loggedInUser?.id, orders, page: 1 } });
      return;
    }

    expect(route.request().method()).toBe('POST');
    const orderReq = route.request().postDataJSON();
    await route.fulfill({ json: { order: { ...orderReq, id: '23' }, jwt: orderJwt } });
  });
}

// Pizza factory: only the JWT handed out by the order mock is valid
export async function mockFactory(page: Page) {
  await page.route('*/**/api/order/verify', async (route) => {
    expect(route.request().method()).toBe('POST');
    const { jwt } = route.request().postDataJSON();
    if (jwt !== orderJwt) {
      await route.fulfill({ status: 404, json: { message: 'invalid' } });
      return;
    }
    const payload = { vendor: { id: 'vendor1', name: 'Pizza Vendor' }, diner: { id: users.diner.id, name: users.diner.name, email: users.diner.email }, order: { id: '23' } };
    await route.fulfill({ json: { message: 'valid', payload } });
  });
}

// Mocks the whole backend with a fresh copy of the test data, then opens the home page
export async function basicInit(page: Page) {
  const state: MockState = {
    users: Object.fromEntries(Object.values(structuredClone(users)).map((user) => [user.email, user])),
    franchises: structuredClone(Object.values(franchises)),
  };

  await mockAuth(page, state);
  await mockMenu(page);
  await mockFranchises(page, state);
  await mockOrders(page, state);
  await mockFactory(page);
  
  await page.goto('/');
}
