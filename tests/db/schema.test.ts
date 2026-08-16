import { describe, it, expect } from 'vitest'
import { getTableColumns } from 'drizzle-orm'
import {
  users,
  events,
  foodOptions,
  activityOptions,
  bringItems,
  eventInvitees,
} from '../../src/db/schema'

describe('schema', () => {
  it('users table has the expected columns', () => {
    expect(Object.keys(getTableColumns(users))).toEqual([
      'id',
      'name',
      'whatsappNumber',
      'createdAt',
    ])
  })

  it('events table has the expected columns', () => {
    expect(Object.keys(getTableColumns(events))).toEqual([
      'id',
      'title',
      'date',
      'startTime',
      'description',
      'status',
      'finalFoodOptionId',
      'finalActivityOptionId',
      'createdAt',
    ])
  })

  it('foodOptions table has the expected columns', () => {
    expect(Object.keys(getTableColumns(foodOptions))).toEqual([
      'id',
      'eventId',
      'name',
      'disabled',
    ])
  })

  it('activityOptions table has the expected columns', () => {
    expect(Object.keys(getTableColumns(activityOptions))).toEqual([
      'id',
      'eventId',
      'name',
    ])
  })

  it('bringItems table has the expected columns', () => {
    expect(Object.keys(getTableColumns(bringItems))).toEqual([
      'id',
      'eventId',
      'name',
      'assignedToUserId',
    ])
  })

  it('eventInvitees table has the expected columns', () => {
    expect(Object.keys(getTableColumns(eventInvitees))).toEqual([
      'id',
      'eventId',
      'userId',
      'inviteToken',
      'tokenExpiresAt',
      'rsvpStatus',
      'declineReason',
      'foodChoice1',
      'foodChoice2',
      'foodChoice3',
      'activityChoice1',
      'activityChoice2',
      'activityChoice3',
      'bringItemId',
      'rsvpAt',
    ])
  })
})
