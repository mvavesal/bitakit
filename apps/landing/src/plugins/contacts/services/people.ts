import { defineService } from '@bitakit/core';
import people from '../data/people.json';
import signups from '../data/signups.json';

export type Person = { id: number; name: string; company: string; role: string; photo?: string };

// Sample contacts and new customers per day from data/; they never change in this demo.
// Photos: Unsplash, free to use under the Unsplash License (https://unsplash.com/license).
export default defineService(({ store }) => ({
  state: store<{ people: Person[]; signups: number[] }>({ people, signups }),
}));
