// Step 7 — Clients · Step 8 — Appointments
import { describe, it, expect } from 'vitest';
import { as } from './helpers.js';

const DAY = '2026-10-05';

describe('Step 7 · Clients', () => {
  it('lists branch clients with derived stats', async () => {
    const res = await as('accountant').get('/clients');
    expect(res.status).toBe(200);
    expect(res.body.data.map((c) => c.id).sort()).toEqual(['client-1', 'client-2']);
    expect(res.body.data[0]).toMatchObject({ outstandingBalance: 0, totalVisits: 0 });
    expect((await as('staff').get('/clients')).status).toBe(403);
  });

  it('creates a client with formatted phone and detects duplicates across phone formats', async () => {
    const res = await as('admin').post('/clients', { name: 'Hira Shah', phone: '0301-2345678', source: 'INSTAGRAM' });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ phone: '+92 (301) 234-5678', source: 'INSTAGRAM', branchId: 'branch-1' });

    const dup = await as('admin').post('/clients', { name: 'Hira 2', phone: '+92 301 2345678' });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('CLIENT_EXISTS');

    expect((await as('admin').post('/clients', { name: 'Bad', phone: '123' })).status).toBe(400);
    expect((await as('accountant').post('/clients', { name: 'X', phone: '03009998877' })).status).toBe(403);
  });

  it('searches by name or phone digits', async () => {
    const byPhone = await as('accountant').get('/clients/search?q=0301 234');
    expect(byPhone.body.data.map((c) => c.name)).toEqual(['Hira Shah']);
    const byName = await as('accountant').get('/clients/search?q=tariq');
    expect(byName.body.data.map((c) => c.id)).toEqual(['client-2']);
  });

  it('updates and archives', async () => {
    const upd = await as('admin').put('/clients/client-2', { notes: 'Prefers mornings' });
    expect(upd.body.data.notes).toBe('Prefers mornings');
    const arc = await as('admin').post('/clients/client-2/archive', { isArchived: true });
    expect(arc.body.data.isArchived).toBe(true);
    await as('admin').post('/clients/client-2/archive', { isArchived: false });
    expect((await as('admin').put('/clients/client-3', { notes: 'x' })).status).toBe(403);
  });
});

describe('Step 8 · Appointments', () => {
  let aptId;

  it('books a service + package sequentially and reuses the client by phone', async () => {
    const res = await as('admin').post('/appointments', {
      clientName: 'Zainab Ahmed', clientPhone: '03001234567', date: DAY, startTime: '10:00', status: 'CONFIRMED',
      items: [
        { type: 'SERVICE', itemId: 'srv-lhe-01', staffId: 'staff-1' },
        { type: 'PACKAGE', itemId: 'pkg-lhe-02', packageComponents: [
          { serviceId: 'srv-lhe-02', staffId: 'staff-2' }, { serviceId: 'srv-lhe-07', staffId: 'staff-1' },
        ] },
      ],
    });
    expect(res.status).toBe(201);
    const a = res.body.data;
    aptId = a.id;
    expect(a).toMatchObject({
      appointmentNumber: 'APT-LHE-01-2026-0001', clientId: 'client-1', status: 'CONFIRMED', billingStatus: 'UNBILLED',
      startTime: '10:00 AM', endTime: '11:55 AM', durationMinutes: 115, price: 10500, branchName: 'Gulberg Flagship Lounge',
      serviceName: 'Signature Blowout & Treatment + Executive Grooming Suite', staffId: 'staff-1',
    });
    expect(a.items[1].packageComponents.map((c) => [c.staffName, c.startTime, c.endTime])).toEqual([
      ['Hamza Malik', '10:45 AM', '11:25 AM'],
      ['Zara Alvi', '11:25 AM', '11:55 AM'],
    ]);
    expect(a.confirmedByName).toBe('Aamina Sheikh');
  });

  it('rejects overlapping slots for the same stylist but allows adjacent ones', async () => {
    const overlap = await as('admin').post('/appointments', {
      clientName: 'Walk In', clientPhone: '03110000001', date: DAY, startTime: '11:30 AM',
      items: [{ type: 'SERVICE', itemId: 'srv-lhe-05', staffId: 'staff-1' }],
    });
    expect(overlap.status).toBe(409);
    expect(overlap.body.error.code).toBe('STAFF_SLOT_CONFLICT');

    const adjacent = await as('admin').post('/appointments', {
      clientName: 'Walk In', clientPhone: '03110000001', date: DAY, startTime: '11:55 AM',
      items: [{ type: 'SERVICE', itemId: 'srv-lhe-05', staffId: 'staff-1' }],
    });
    expect(adjacent.status).toBe(201);
    expect(adjacent.body.data.status).toBe('PENDING');
  });

  it('rejects bookings outside the stylist shift, missing staff and wrong-branch items', async () => {
    const early = await as('admin').post('/appointments', {
      clientName: 'A', clientPhone: '03110000002', date: DAY, startTime: '08:00',
      items: [{ type: 'SERVICE', itemId: 'srv-lhe-01', staffId: 'staff-1' }],
    });
    expect(early.status).toBe(400);
    expect(early.body.error.code).toBe('OUTSIDE_SHIFT');

    const noStaff = await as('admin').post('/appointments', {
      clientName: 'A', clientPhone: '03110000002', date: DAY, startTime: '13:00', items: [{ type: 'SERVICE', itemId: 'srv-lhe-01' }],
    });
    expect(noStaff.status).toBe(400);

    const khi = await as('admin').post('/appointments', {
      clientName: 'A', clientPhone: '03110000002', date: DAY, startTime: '13:00', items: [{ type: 'SERVICE', itemId: 'srv-khi-01', staffId: 'staff-1' }],
    });
    expect(khi.status).toBe(400);
    expect((await as('accountant').post('/appointments', {})).status).toBe(403);
  });

  it('filters the calendar by date, staff and search', async () => {
    const byDay = await as('admin').get(`/appointments?date=${DAY}`);
    expect(byDay.body.data).toHaveLength(2);
    expect(byDay.body.data[0].startTime).toBe('10:00 AM');
    const byStaff = await as('admin').get(`/appointments?staffId=staff-2`);
    expect(byStaff.body.data).toHaveLength(1);
    const bySearch = await as('admin').get(`/appointments?search=zainab`);
    expect(bySearch.body.data).toHaveLength(1);
    expect((await as('staff').get('/appointments')).status).toBe(403);
  });

  it('reschedules with an audit trail and frees the old slot', async () => {
    const res = await as('admin').post(`/appointments/${aptId}/reschedule`, { date: DAY, startTime: '02:00 PM', reason: 'Client request' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ startTime: '02:00 PM', endTime: '03:55 PM' });
    expect(res.body.data.rescheduleHistory[0]).toMatchObject({ previousStartTime: '10:00 AM', newStartTime: '02:00 PM', reason: 'Client request' });

    const freed = await as('admin').post('/appointments', {
      clientName: 'B', clientPhone: '03110000003', date: DAY, startTime: '10:00',
      items: [{ type: 'SERVICE', itemId: 'srv-lhe-02', staffId: 'staff-2' }],
    });
    expect(freed.status).toBe(201);
  });

  it('enforces the status flow and cancel reasons', async () => {
    const skip = await as('admin').patch(`/appointments/${aptId}/status`, { status: 'PENDING' });
    expect(skip.status).toBe(400);
    for (const s of ['CHECKED_IN', 'IN_SERVICE']) {
      expect((await as('admin').patch(`/appointments/${aptId}/status`, { status: s })).body.data.status).toBe(s);
    }
    const noShow = await as('admin').patch(`/appointments/${aptId}/status`, { status: 'NO_SHOW' });
    expect(noShow.status).toBe(400);

    const queue = await as('accountant').get(`/appointments/queue?date=${DAY}`);
    expect(queue.body.data.map((a) => a.id)).toContain(aptId);

    const done = await as('admin').patch(`/appointments/${aptId}/status`, { status: 'COMPLETED' });
    expect(done.body.data.status).toBe('COMPLETED');
  });

  it('cancelling releases the slot; cancelled appointments cannot be rescheduled', async () => {
    const list = await as('admin').get(`/appointments?date=${DAY}&staffId=staff-2`);
    const target = list.body.data.find((a) => a.clientName === 'B');
    const c = await as('admin').patch(`/appointments/${target.id}/status`, { status: 'CANCELLED', cancelReason: 'Sick' });
    expect(c.body.data).toMatchObject({ status: 'CANCELLED', cancelReason: 'Sick' });
    const rs = await as('admin').post(`/appointments/${target.id}/reschedule`, { date: DAY, startTime: '12:00' });
    expect(rs.status).toBe(409);
  });

  it('builds the WhatsApp confirmation message', async () => {
    const res = await as('admin').get(`/appointments/${aptId}/confirmation-message`);
    expect(res.body.data.whatsappUrl).toMatch(/^https:\/\/wa\.me\/923001234567\?text=/);
    expect(res.body.data.servicesList).toEqual(['Signature Blowout & Treatment', 'Executive Grooming Suite (Package)']);
  });

  it('completed appointments count as client visits', async () => {
    const c = await as('admin').get('/clients/client-1');
    expect(c.body.data).toMatchObject({ totalVisits: 1, lastVisitDate: DAY });
  });
});
