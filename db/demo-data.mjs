/**
 * VELORA PRIVATE — demonstration dataset.
 *
 * Single source of truth for the seeded demo: consumed both by the runtime
 * auto-seeder (src/lib/db/index.ts) and by `node scripts/db-cli.mjs`.
 *
 * All dates are expressed as offsets from "now" so the demo never looks stale.
 * Amounts are integer cents. No real people, no real client data.
 */

/** Demo credentials (local development only — printed on the login screen). */
export const DEMO_CREDENTIALS = {
  owner: { email: 'alexander@velora.private', password: 'Velora2026!' },
  admin: { email: 'admin@velora.private', password: 'VeloraAdmin2026!' },
  client2: { email: 'henrik@sund-familyoffice.li', password: 'Velora2026!' },
};

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

/** ISO timestamp `n` days from now (n may be fractional / negative). */
function at(now, n) {
  return new Date(now.getTime() + n * DAY).toISOString();
}
/** ISO timestamp `n` days from now, pinned to a local HH:MM. */
function on(now, n, hh = 9, mm = 0) {
  const d = new Date(now.getTime() + n * DAY);
  d.setUTCHours(hh, mm, 0, 0);
  return d.toISOString();
}
/** First instant of the month `m` months before now (negative = past). */
function monthStart(now, m) {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + m, 1, 0, 0, 0));
  return d;
}

const LANG = {
  en: ['English', 'French'],
  fr: ['French', 'English'],
  it: ['Italian', 'English'],
  multi: ['French', 'English', 'Italian'],
  de: ['German', 'English', 'French'],
};

/**
 * Build the complete demo dataset.
 * @param {Date} [now]
 */
export function buildDemoDataset(now = new Date()) {
  const OWNER = 'usr_alexander';
  const ADMIN = 'usr_admin';
  const CLIENT2 = 'usr_henrik';

  const created = at(now, -420);

  /* ---------------------------------------------------------------- users */
  const users = [
    {
      id: OWNER,
      email: DEMO_CREDENTIALS.owner.email,
      password: DEMO_CREDENTIALS.owner.password,
      first_name: 'Alexander',
      last_name: 'Reid',
      role: 'owner',
      status: 'active',
      country: 'Monaco',
      timezone: 'Europe/Monaco',
      locale: 'en-GB',
      currency: 'EUR',
      avatar_initials: 'AR',
      briefing_time: '07:00',
      notifications_json: JSON.stringify({
        daily_briefing: true,
        property_alerts: true,
        travel_updates: true,
        expense_review: true,
        staff_requests: false,
        channel: 'in_app_and_email',
      }),
      last_login_at: at(now, -0.02),
      created_at: created,
      updated_at: at(now, -0.02),
    },
    {
      id: ADMIN,
      email: DEMO_CREDENTIALS.admin.email,
      password: DEMO_CREDENTIALS.admin.password,
      first_name: 'Isabelle',
      last_name: 'Fontaine',
      role: 'admin',
      status: 'active',
      country: 'France',
      timezone: 'Europe/Paris',
      locale: 'fr-FR',
      currency: 'EUR',
      avatar_initials: 'IF',
      briefing_time: '06:30',
      notifications_json: JSON.stringify({ daily_briefing: true, channel: 'in_app' }),
      last_login_at: at(now, -0.4),
      created_at: at(now, -700),
      updated_at: at(now, -0.4),
    },
    {
      id: CLIENT2,
      email: DEMO_CREDENTIALS.client2.email,
      password: DEMO_CREDENTIALS.client2.password,
      first_name: 'Henrik',
      last_name: 'Sund',
      role: 'owner',
      status: 'active',
      country: 'Liechtenstein',
      timezone: 'Europe/Vaduz',
      locale: 'en-GB',
      currency: 'EUR',
      avatar_initials: 'HS',
      briefing_time: '07:30',
      notifications_json: JSON.stringify({ daily_briefing: true, channel: 'in_app' }),
      last_login_at: at(now, -2.4),
      created_at: at(now, -180),
      updated_at: at(now, -2.4),
    },
  ];

  /* ----------------------------------------------------------- properties */
  const properties = [
    {
      id: 'prop_azure',
      user_id: OWNER,
      name: 'Villa Azure',
      city: 'Saint-Barthélemy',
      country: 'Saint-Barthélemy',
      kind: 'villa',
      status: 'attention',
      is_primary: 0,
      bedrooms: 6,
      bathrooms: 7,
      area_sqm: 740,
      staff_on_site: 4,
      temperature_c: 27.4,
      humidity_pct: 71,
      last_maintenance_at: at(now, -11),
      next_service_at: on(now, 8, 8),
      monthly_ops_cents: 1842000,
      notes:
        'Pool plant service confirmation outstanding with Caraïbes Techniques. Generator fuel top-up scheduled before the island hurricane advisory window.',
      accent: 'gold',
      created_at: created,
      updated_at: at(now, -0.2),
    },
    {
      id: 'prop_vauban',
      user_id: OWNER,
      name: 'Hôtel Particulier Vauban',
      city: 'Paris',
      country: 'France',
      kind: 'estate',
      status: 'operational',
      is_primary: 0,
      bedrooms: 5,
      bathrooms: 4,
      area_sqm: 460,
      staff_on_site: 3,
      temperature_c: 21.2,
      humidity_pct: 44,
      last_maintenance_at: at(now, -4),
      next_service_at: on(now, 21, 9, 30),
      monthly_ops_cents: 1128000,
      notes: 'Courtyard re-lighting approved. Historic-monument constraints on façade works.',
      accent: 'ivory',
      created_at: created,
      updated_at: at(now, -1.1),
    },
    {
      id: 'prop_monaco',
      user_id: OWNER,
      name: 'Monte Carlo Penthouse',
      city: 'Monaco',
      country: 'Monaco',
      kind: 'penthouse',
      status: 'operational',
      is_primary: 1,
      bedrooms: 4,
      bathrooms: 5,
      area_sqm: 520,
      staff_on_site: 2,
      temperature_c: 22.8,
      humidity_pct: 48,
      last_maintenance_at: at(now, -18),
      next_service_at: on(now, 34, 10),
      monthly_ops_cents: 962400,
      notes: 'Residence of record. Arrival protocol: ports de charge, still water, fresh magnolias.',
      accent: 'gold',
      created_at: created,
      updated_at: at(now, -0.05),
    },
    {
      id: 'prop_emirates',
      user_id: OWNER,
      name: 'Emirates Hills Residence',
      city: 'Dubai',
      country: 'United Arab Emirates',
      kind: 'villa',
      status: 'standby',
      is_primary: 0,
      bedrooms: 7,
      bathrooms: 9,
      area_sqm: 1180,
      staff_on_site: 1,
      temperature_c: 24.0,
      humidity_pct: 39,
      last_maintenance_at: at(now, -46),
      next_service_at: on(now, 63, 7),
      monthly_ops_cents: 742000,
      notes: 'On cold standby until the December season. Pool drained, villa sealed, security patrol nightly.',
      accent: 'graphite',
      created_at: created,
      updated_at: at(now, -12),
    },
    {
      id: 'prop_belgravia',
      user_id: OWNER,
      name: 'Belgravia Townhouse',
      city: 'London',
      country: 'United Kingdom',
      kind: 'townhouse',
      status: 'operational',
      is_primary: 0,
      bedrooms: 4,
      bathrooms: 3,
      area_sqm: 340,
      staff_on_site: 2,
      temperature_c: 19.6,
      humidity_pct: 52,
      last_maintenance_at: at(now, -9),
      next_service_at: on(now, 26, 11),
      monthly_ops_cents: 688400,
      notes: 'Boiler service certificate filed. Basement wine store humidity holding at 68%.',
      accent: 'steel',
      created_at: created,
      updated_at: at(now, -3),
    },
    {
      id: 'prop_cervin',
      user_id: OWNER,
      name: 'Chalet Le Cervin',
      city: 'Zermatt',
      country: 'Switzerland',
      kind: 'chalet',
      status: 'maintenance',
      is_primary: 0,
      bedrooms: 5,
      bathrooms: 5,
      area_sqm: 410,
      staff_on_site: 0,
      temperature_c: 11.5,
      humidity_pct: 57,
      last_maintenance_at: at(now, -2),
      next_service_at: on(now, 3, 14),
      monthly_ops_cents: 396800,
      notes:
        'Sauna cladding replacement in progress. Access restricted — supplier escort required for all mountain deliveries.',
      accent: 'sage',
      created_at: created,
      updated_at: at(now, -0.5),
    },
    /* second client — visible to the admin console only */
    {
      id: 'prop_vaduz',
      user_id: CLIENT2,
      name: 'Residenz Schaanwald',
      city: 'Schaan',
      country: 'Liechtenstein',
      kind: 'estate',
      status: 'operational',
      is_primary: 1,
      bedrooms: 6,
      bathrooms: 5,
      area_sqm: 620,
      staff_on_site: 3,
      temperature_c: 20.1,
      humidity_pct: 46,
      last_maintenance_at: at(now, -6),
      next_service_at: on(now, 17, 8, 30),
      monthly_ops_cents: 918000,
      notes: '',
      accent: 'ivory',
      created_at: at(now, -180),
      updated_at: at(now, -1.2),
    },
    {
      id: 'prop_gstaad',
      user_id: CLIENT2,
      name: 'Chalet Edelweiss',
      city: 'Gstaad',
      country: 'Switzerland',
      kind: 'chalet',
      status: 'attention',
      is_primary: 0,
      bedrooms: 4,
      bathrooms: 4,
      area_sqm: 300,
      staff_on_site: 1,
      temperature_c: 9.8,
      humidity_pct: 61,
      last_maintenance_at: at(now, -30),
      next_service_at: on(now, 5, 9),
      monthly_ops_cents: 452000,
      notes: 'Roof drainage inspection requested after the August storms.',
      accent: 'sage',
      created_at: at(now, -150),
      updated_at: at(now, -4),
    },
  ];

  /* ---------------------------------------------------------------- staff */
  const staffSeed = [
    ['stf_lindqvist', 'Marcus', 'Lindqvist', 'estate_manager', 'on_site', 'prop_monaco', LANG.de, 9, -0.1, 'Confirmed arrival protocol with concierge desk', on(now, 0, 8, 20), 'Villa Azure maintenance escalation', 96],
    ['stf_rousseau', 'Amélie', 'Rousseau', 'housekeeper', 'on_site', 'prop_vauban', LANG.fr, 6, -0.3, 'Linen rotation completed for floors 1–2', on(now, 0, 7, 45), 'Prepare west wing for Friday dinner', 92],
    ['stf_doyle', 'Liam', 'Doyle', 'security', 'available', 'prop_belgravia', LANG.en, 4, -1.2, 'Night patrol log closed — nothing to report', on(now, -0.05, 23, 10), 'Advise on Monaco arrival perimeter', 89],
    ['stf_ferrand', 'Antoine', 'Ferrand', 'chef', 'available', 'prop_monaco', LANG.multi, 3, -0.6, 'Submitted arrival menu for approval', on(now, -0.25, 18, 30), 'Finalise 18 Sept dinner service', 94],
    ['stf_ando', 'Yuki', 'Ando', 'personal_assistant', 'on_site', 'prop_monaco', ['English', 'Japanese', 'French'], 5, -0.01, 'Updated the Monaco arrival checklist', on(now, 0, 6, 55), 'Confirm chauffeur handover at 19:40', 97],
    ['stf_mensah', 'Kofi', 'Mensah', 'maintenance', 'available', 'prop_azure', ['English', 'French', 'Twi'], 7, -0.8, 'Pool plant readings logged — pH 7.2', on(now, -0.1, 16, 0), 'Awaiting supplier confirmation — 14 Sept service', 85],
    ['stf_pitre', 'Jean-Baptiste', 'Pitre', 'estate_manager', 'available', 'prop_azure', LANG.fr, 8, -1.6, 'Generator fuel delivered (1,200 L)', on(now, -0.9, 11, 15), 'Coordinate pre-storm checks', 90],
    ['stf_nuaimi', 'Rashid', 'Al Nuaimi', 'driver', 'off_duty', 'prop_emirates', ['Arabic', 'English'], 6, -2.4, 'Vehicle handover to fleet storage complete', on(now, -1.4, 20, 0), 'Ready Maybach for December arrival', 88],
    ['stf_whitfield', 'James', 'Whitfield', 'butler', 'on_site', 'prop_belgravia', LANG.en, 11, -0.45, 'Silver cleaning and cellar audit', on(now, -0.15, 17, 20), 'Set arrival tray for 12 Sept', 93],
    ['stf_berger', 'Thomas', 'Berger', 'gardener', 'available', 'prop_cervin', LANG.de, 2, -3.1, 'Winter planting plan delivered', on(now, -1.1, 9, 0), 'Await access clearance for cladding works', 81],
    ['stf_cesar', 'Marie-Laure', 'César', 'housekeeper', 'on_site', 'prop_azure', ['French', 'English', 'Creole'], 5, -0.2, 'Beach villa turnover complete', on(now, 0, 7, 5), 'Deep clean for October rental hold', 91],
    ['stf_deluca', 'Marco', 'Deluca', 'chef', 'on_leave', 'prop_emirates', LANG.it, 4, -6.2, 'Leave until 2 October — recorded', on(now, -5.4, 14, 0), 'None', 87],
    ['stf_petrova', 'Elena', 'Petrova', 'nanny', 'available', 'prop_vauban', ['Russian', 'English', 'French'], 3, -0.9, 'School run confirmed for 12 Sept', on(now, -0.4, 15, 40), 'Prepare children’s suite', 89],
    ['stf_okafor', 'Chidi', 'Okafor', 'security', 'on_site', 'prop_cervin', LANG.en, 6, -0.7, 'Escort schedule for mountain deliveries agreed', on(now, -0.02, 5, 30), 'Verify supplier identity — cladding crew', 90],
    ['stf_grieder', 'Nina', 'Grieder', 'driver', 'available', 'prop_cervin', ['German', 'French', 'English'], 2, -1.9, 'Swiss plate renewal filed', on(now, -1.2, 12, 0), 'None', 86],
    ['stf_marais', 'Julien', 'Le Marais', 'maintenance', 'available', 'prop_vauban', LANG.fr, 3, -0.5, 'Courtyard lighting commissioning signed off', on(now, -0.3, 10, 10), 'Annual chimney sweep — book before Oct', 88],
    // second client's household
    ['stf_haas', 'David', 'Haas', 'estate_manager', 'on_site', 'prop_vaduz', ['German', 'English'], 12, -0.6, 'Winter staffing roster circulated', on(now, -0.2, 16, 45), 'Confirm Gstaad roof inspection', 93],
    ['stf_brunner', 'Sandra', 'Brunner', 'housekeeper', 'available', 'prop_gstaad', ['German', 'French'], 4, -2.2, 'Post-storm moisture reading taken', on(now, -1.3, 9, 15), 'Await scaffolding for drainage check', 87],
  ];

  const staff = staffSeed.map(
    ([id, first_name, last_name, role, status, property_id, languages, years_with_house, lastOff, last_activity, last_activity_at, next_task, rating], i) => ({
      id,
      user_id: id === 'stf_haas' || id === 'stf_brunner' ? CLIENT2 : OWNER,
      property_id,
      first_name,
      last_name,
      role,
      status,
      employment: i % 5 === 0 ? 'daily' : i % 3 === 0 ? 'part_time' : 'full_time',
      email: `${first_name.split(' ')[0].toLowerCase().replace(/[^a-z]/g, '')}.${last_name.toLowerCase().replace(/[^a-z]/g, '')}@velora-household.example`,
      phone: '+377 6 ' + String(40 + (i % 9)) + ' ' + String(10 + i) + ' ' + String(20 + i) + ' ' + String(30 + i),
      languages: JSON.stringify(languages),
      years_with_house: years_with_house,
      last_activity: last_activity,
      last_activity_at,
      next_task,
      rating,
      notes: '',
      created_at: at(now, -300 + i),
      updated_at: at(now, lastOff),
    }),
  );

  /* -------------------------------------------------------------- vehicles */
  const vehicles = [
    {
      id: 'veh_range', user_id: OWNER, property_id: 'prop_belgravia', make: 'Land Rover', model: 'Range Rover Autobiography',
      year: 2024, plate: 'LON · VR7', kind: 'suv', mileage_km: 21480, service_interval_km: 16000,
      last_service_at: on(now, -96, 9), next_service_at: on(now, 24, 9), next_service_km: 32000,
      insurance_provider: 'Marsh Private Clients', insurance_status: 'active', insurance_expires_at: on(now, 214, 0),
      location: 'Belgravia Townhouse — basement garage', assigned_driver_id: 'stf_whitfield', status: 'ready',
      fuel_level_pct: 78, notes: 'Ski conversion fitted. Winter tyres stored on site.',
      created_at: created, updated_at: at(now, -0.4),
    },
    {
      id: 'veh_ferrari', user_id: OWNER, property_id: 'prop_monaco', make: 'Ferrari', model: 'Roma',
      year: 2023, plate: 'MC · 218', kind: 'gt', mileage_km: 6240, service_interval_km: 12000,
      last_service_at: on(now, -210, 10), next_service_at: on(now, 61, 10), next_service_km: 12000,
      insurance_provider: 'Aon Private & Family Office', insurance_status: 'expiring', insurance_expires_at: on(now, 21, 0),
      location: 'Monte Carlo Penthouse — garage level 2, bay 7', assigned_driver_id: 'stf_ando', status: 'ready',
      fuel_level_pct: 62, notes: 'Battery conditioner in use. Cover required for outdoor storage.',
      created_at: created, updated_at: at(now, -0.9),
    },
    {
      id: 'veh_maybach', user_id: OWNER, property_id: 'prop_vauban', make: 'Mercedes-Maybach', model: 'S 680',
      year: 2025, plate: 'PAR · VEL4', kind: 'limousine', mileage_km: 12960, service_interval_km: 20000,
      last_service_at: on(now, -40, 8), next_service_at: on(now, 190, 8), next_service_km: 20000,
      insurance_provider: 'AXA XL Private Client', insurance_status: 'active', insurance_expires_at: on(now, 300, 0),
      location: 'Hôtel Particulier Vauban — courtyard', assigned_driver_id: 'stf_rousseau', status: 'in_use',
      fuel_level_pct: 91, notes: 'Primary airport transfer vehicle for Paris arrivals.',
      created_at: created, updated_at: at(now, -0.05),
    },
    {
      id: 'veh_bentley', user_id: OWNER, property_id: 'prop_emirates', make: 'Bentley', model: 'Flying Spur Mulliner',
      year: 2022, plate: 'DUB · F5', kind: 'sedan', mileage_km: 38120, service_interval_km: 10000,
      last_service_at: on(now, -150, 11), next_service_at: on(now, -12, 11), next_service_km: 45000,
      insurance_provider: 'Gulf Union — Private Fleet', insurance_status: 'active', insurance_expires_at: on(now, 122, 0),
      location: 'Emirates Hills Residence — motor court', assigned_driver_id: 'stf_nuaimi', status: 'stored',
      fuel_level_pct: 45, notes: 'Service overdue while on standby — book with dealer before December.',
      created_at: created, updated_at: at(now, -12),
    },
    {
      id: 'veh_g63', user_id: OWNER, property_id: 'prop_cervin', make: 'Mercedes-AMG', model: 'G 63',
      year: 2024, plate: 'VS · 4412', kind: 'suv', mileage_km: 9870, service_interval_km: 15000,
      last_service_at: on(now, -70, 9), next_service_at: on(now, 110, 9), next_service_km: 20000,
      insurance_provider: 'Helvetia Private', insurance_status: 'active', insurance_expires_at: on(now, 178, 0),
      location: 'Chalet Le Cervin — covered bay', assigned_driver_id: 'stf_grieder', status: 'ready',
      fuel_level_pct: 70, notes: 'Snow chains verified. Tarmac nails inspected 4 Sept.',
      created_at: created, updated_at: at(now, -2),
    },
    {
      id: 'veh_van', user_id: OWNER, property_id: 'prop_azure', make: 'Mercedes-Benz', model: 'Sprinter VIP',
      year: 2023, plate: 'SBH · 118', kind: 'van', mileage_km: 41250, service_interval_km: 20000,
      last_service_at: on(now, -25, 7), next_service_at: on(now, 65, 7), next_service_km: 60000,
      insurance_provider: 'AIG Caribbean', insurance_status: 'active', insurance_expires_at: on(now, 64, 0),
      location: 'Villa Azure — service yard', assigned_driver_id: 'stf_pitre', status: 'in_service',
      fuel_level_pct: 34, notes: 'Crew shuttle. Air-con recharge booked.',
      created_at: created, updated_at: at(now, -1),
    },
  ];

  /* ------------------------------------------------------- trips + legs   */
  const trips = [
    {
      id: 'trip_par_mon', user_id: OWNER, title: 'Paris → Monaco', origin_city: 'Paris', destination_city: 'Monaco',
      property_id: 'prop_monaco', starts_at: on(now, 12, 17, 40), ends_at: on(now, 16, 12),
      mode: 'jet', status: 'confirmed', travelers: 3,
      notes: 'Arrival evening. Dinner reservation requested, awaiting confirmation from the restaurant.',
      created_at: at(now, -9), updated_at: at(now, -0.2),
    },
    {
      id: 'trip_lon_par', user_id: OWNER, title: 'London → Paris', origin_city: 'London', destination_city: 'Paris',
      property_id: 'prop_vauban', starts_at: on(now, 6, 8, 15), ends_at: on(now, 9, 20),
      mode: 'train', status: 'confirmed', travelers: 2,
      notes: 'Board meeting Friday. Vauban staff briefed for 3 guests.',
      created_at: at(now, -20), updated_at: at(now, -0.6),
    },
    {
      id: 'trip_dub_sbh', user_id: OWNER, title: 'Dubai → Saint-Barth', origin_city: 'Dubai', destination_city: 'Saint-Barthélemy',
      property_id: 'prop_azure', starts_at: on(now, 20, 22, 5), ends_at: on(now, 27, 18),
      mode: 'jet', status: 'pending', travelers: 5,
      notes: 'Contingent on pool service sign-off and storm advisory review.',
      created_at: at(now, -4), updated_at: at(now, -0.35),
    },
    {
      id: 'trip_mon_zer', user_id: OWNER, title: 'Monaco → Zermatt', origin_city: 'Monaco', destination_city: 'Zermatt',
      property_id: 'prop_cervin', starts_at: on(now, 16, 11, 0), ends_at: on(now, 18, 19),
      mode: 'car', status: 'draft', travelers: 4,
      notes: 'Chalet works still open — hold until cladding completion is confirmed.',
      created_at: at(now, -1), updated_at: at(now, -0.1),
    },
    {
      id: 'trip_par_lon_past', user_id: OWNER, title: 'Paris → London', origin_city: 'Paris', destination_city: 'London',
      property_id: 'prop_belgravia', starts_at: on(now, -14, 7, 30), ends_at: on(now, -11, 21),
      mode: 'train', status: 'completed', travelers: 2, notes: '', created_at: at(now, -40), updated_at: at(now, -11),
    },
    {
      id: 'trip_vad_gst', user_id: CLIENT2, title: 'Schaan → Gstaad', origin_city: 'Schaan', destination_city: 'Gstaad',
      property_id: 'prop_gstaad', starts_at: on(now, 5, 10, 0), ends_at: on(now, 8, 18),
      mode: 'car', status: 'pending', travelers: 4, notes: 'Awaiting scaffolding removal report.',
      created_at: at(now, -6), updated_at: at(now, -0.8),
    },
  ];

  const leg = (trip_id, user_id, position, kind, label, detail, dayOffset, hh, mm, provider, status, reference) => ({
    id: `leg_${trip_id}_${position}`,
    user_id,
    trip_id,
    position,
    kind,
    label,
    detail,
    at: dayOffset === null ? null : on(now, dayOffset, hh, mm),
    provider,
    status,
    reference,
  });

  const trip_legs = [
    leg('trip_par_mon', OWNER, 0, 'transfer', 'Residence → Le Bourget', 'Maybach S 680 · door staff briefed', 12, 16, 10, 'VELORA Household Fleet', 'confirmed', 'TR-8841'),
    leg('trip_par_mon', OWNER, 1, 'flight', 'Private jet — LBG → MON', '3 guests · one holdall each', 12, 17, 40, 'Air Culinaire (management contract)', 'confirmed', 'AC-26911'),
    leg('trip_par_mon', OWNER, 2, 'arrival', 'Arrival — Monte Carlo Penthouse', 'House prepared · arrival tray set', 12, 19, 40, 'Estate Manager — M. Lindqvist', 'confirmed', null),
    leg('trip_par_mon', OWNER, 3, 'dinner', 'Dinner — Le Louis XV', 'Table for 3 requested, 21 September', null, 0, 0, 'Ambassade d’Auguste', 'requested', null),
    leg('trip_par_mon', OWNER, 4, 'meeting', 'Advisers meeting', 'Family office quarterly', 14, 9, 30, 'Hôtel de Paris salon', 'pending', null),

    leg('trip_lon_par', OWNER, 0, 'transfer', 'Belgravia → St Pancras', 'Driver and luggage handling', 6, 6, 40, 'VELORA Household Fleet', 'confirmed', 'TR-8790'),
    leg('trip_lon_par', OWNER, 1, 'train', 'Eurostar 9024 — London → Paris', 'Business Premier · platform assistance', 6, 8, 15, 'Eurostar', 'confirmed', 'ES-9024'),
    leg('trip_lon_par', OWNER, 2, 'arrival', 'Arrival — Hôtel Particulier Vauban', 'Two suites, children’s room turned down', 6, 12, 0, 'Amélie Rousseau', 'confirmed', null),
    leg('trip_lon_par', OWNER, 3, 'departure', 'Return — Paris → London', 'Working dinner on board', 9, 18, 30, 'Eurostar', 'pending', null),

    leg('trip_dub_sbh', OWNER, 0, 'flight', 'Al Maktoum → Gustavia', 'Long-range · 5 guests', 20, 22, 5, 'SkyBridge Aviation', 'pending', 'SB-44102'),
    leg('trip_dub_sbh', OWNER, 1, 'arrival', 'Arrival — Villa Azure', 'Storm checks complete · provisioning confirmed', 21, 9, 40, 'Jean-Baptiste Pitre', 'pending', null),

    leg('trip_mon_zer', OWNER, 0, 'transfer', 'Monaco → Zermatt (via Geneva)', 'G 63 driven by N. Grieder', 16, 11, 0, 'VELORA Household Fleet', 'pending', 'TR-8856'),
    leg('trip_vad_gst', CLIENT2, 0, 'arrival', 'Chalet Edelweiss — arrival', 'Supplier escort required', 5, 13, 0, 'D. Haas', 'pending', null),
  ];

  /* --------------------------------------------------------------- tasks */
  const taskSeed = [
    ['tsk_pool', OWNER, 'prop_azure', 'stf_mensah', 'Pool plant service — obtain written confirmation', 'maintenance', 'awaiting_confirmation', 'critical', 8, 'manual', 1,
      'Supplier Caraïbes Techniques has not acknowledged the 14 September service window. Escalate to the estate manager if unconfirmed by end of day.'],
    ['tsk_generator', OWNER, 'prop_azure', 'stf_pitre', 'Pre-storm generator fuel top-up', 'maintenance', 'in_progress', 'high', 4, 'ai', 0,
      'Fuel delivery of 1,200 L received. Storm shutter audit still open.'],
    ['tsk_arrival', OWNER, 'prop_monaco', 'stf_ando', 'Prepare residence for 18 September arrival', 'housekeeping', 'pending', 'high', 12, 'ai', 0,
      'Arrival protocol: magnolias, still water 12×, pressed linen, garage bay 7 cleared.'],
    ['tsk_dinner', OWNER, 'prop_monaco', 'stf_ferrand', 'Dinner reservation — Le Louis XV', 'lifestyle', 'awaiting_confirmation', 'normal', 14, 'ai', 1,
      'Reservation requires confirmation: request sent to the restaurant, no booking exists yet.'],
    ['tsk_menu', OWNER, 'prop_monaco', 'stf_ferrand', 'Approve arrival menu for the party of 3', 'lifestyle', 'pending', 'normal', 10, 'manual', 0, ''],
    ['tsk_driver', OWNER, 'prop_vauban', 'stf_rousseau', 'Confirm chauffeur handover for Monday', 'travel', 'pending', 'high', 5, 'ai', 0, ''],
    ['tsk_chimney', OWNER, 'prop_vauban', 'stf_marais', 'Book annual chimney sweep before October', 'maintenance', 'pending', 'normal', 26, 'manual', 0, ''],
    ['tsk_ferrari_insure', OWNER, 'prop_monaco', null, 'Ferrari policy renewal — decide on cover terms', 'finance', 'pending', 'high', 21, 'system', 0,
      'Aon renewal quote received. Expiring in 21 days.'],
    ['tsk_bentley_service', OWNER, 'prop_emirates', 'stf_nuaimi', 'Bentley service overdue — book dealer slot', 'vehicles', 'blocked', 'high', -12, 'system', 0,
      'Blocked: vehicle on standby in Dubai. Dealer requires plate inspection.'],
    ['tsk_cervin_cladding', OWNER, 'prop_cervin', 'stf_berger', 'Chalet cladding works — completion report', 'maintenance', 'in_progress', 'normal', 3, 'manual', 0, ''],
    ['tsk_cervin_access', OWNER, 'prop_cervin', 'stf_okafor', 'Verify identity of cladding crew on arrival', 'security', 'pending', 'high', 3, 'ai', 0, ''],
    ['tsk_staff_review', OWNER, 'prop_belgravia', 'stf_whitfield', 'Quarterly staff reviews — schedule 4 conversations', 'staff', 'pending', 'normal', 30, 'manual', 0, ''],
    ['tsk_linen', OWNER, 'prop_vauban', 'stf_rousseau', 'Linen rotation and winter stock order', 'housekeeping', 'done', 'low', -1, 'manual', 0, ''],
    ['tsk_wine', OWNER, 'prop_belgravia', 'stf_whitfield', 'Cellar audit — reconcile Berry Bros invoice', 'finance', 'done', 'normal', -3, 'system', 0, ''],
    ['tsk_humidity', OWNER, 'prop_cervin', 'stf_berger', 'Humidity reading above 57% — monitor daily', 'maintenance', 'in_progress', 'normal', 1, 'system', 0, ''],
    ['tsk_henrik_roof', CLIENT2, 'prop_gstaad', 'stf_brunner', 'Roof drainage inspection — scaffolding required', 'maintenance', 'awaiting_confirmation', 'high', 5, 'system', 1,
      'Access to the north face requires a lift; supplier awaiting site confirmation.'],
  ];

  const tasks = taskSeed.map(([id, user_id, property_id, staff_id, title, category, status, priority, dueIn, origin, requires_confirmation, detail], i) => ({
    id,
    user_id,
    property_id,
    staff_id,
    title,
    category,
    status,
    priority,
    due_at: dueIn === null ? null : on(now, dueIn, 17, 0),
    completed_at: status === 'done' ? at(now, -0.4 - i * 0.01) : null,
    origin,
    origin_ref: origin === 'ai' ? 'conv_command_center' : null,
    requires_confirmation,
    detail,
    created_at: at(now, -6 - (i % 5)),
    updated_at: at(now, -(0.1 + (i % 7) * 0.4)),
  }));

  /* ------------------------------------------------- expenses + history */
  const CATEGORIES = [
    ['property_operations', 'Property operations', 'gold'],
    ['staff', 'Staff', 'ivory'],
    ['vehicles', 'Vehicles', 'graphite'],
    ['travel', 'Travel', 'steel'],
    ['lifestyle', 'Lifestyle', 'sage'],
    ['advisers', 'Advisers & insurance', 'graphite'],
  ];
  const expense_categories = CATEGORIES.map(([key, label, tone]) => ({
    id: `cat_${key}`,
    user_id: OWNER,
    key,
    label,
    tone,
  }));
  expense_categories.push(
    { id: 'cat_h_property', user_id: CLIENT2, key: 'property_operations', label: 'Property operations', tone: 'gold' },
    { id: 'cat_h_staff', user_id: CLIENT2, key: 'staff', label: 'Staff', tone: 'ivory' },
    { id: 'cat_h_vehicles', user_id: CLIENT2, key: 'vehicles', label: 'Vehicles', tone: 'graphite' },
  );

  const expenses = [];

  /* ---- Current month: line items that reconcile to the cent ----------
     Category targets are the figures shown across the product. The last
     line of each category absorbs any rounding remainder, so the ledger
     and the marketing copy can never drift apart. */
  const CATEGORY_TARGETS = {
    property_operations: 1842000, // €18,420
    staff: 1280000, // €12,800
    vehicles: 428000, // €4,280
    travel: 864000, // €8,640
    lifestyle: 592000, // €5,920
    advisers: 0,
  };
  const currentLines = [
    ['property_operations', 'Villa Azure — grounds and pool plant', 'Caraïbes Techniques', 412000, 'prop_azure', 2],
    ['property_operations', 'Monte Carlo Penthouse — concierge levies', 'Cambaces Concierge Desk', 289000, 'prop_monaco', 3],
    ['property_operations', 'Belgravia — boiler service certificate', 'Pimm Maintenance', 148000, 'prop_belgravia', 4],
    ['property_operations', 'Hôtel Particulier Vauban — winter linen stock', 'Descamps Linge', 226000, 'prop_vauban', 5],
    ['property_operations', 'Chalet Le Cervin — cladding materials (stage 1)', 'Atelier Bois Zermatt', 512000, 'prop_cervin', 6],
    ['property_operations', 'Emirates Hills — standby utilities', 'DEWA', 255000, 'prop_emirates', 6],
    ['staff', 'Estate manager payroll — this month', 'VELORA Payroll · M. Lindqvist', 540000, 'prop_monaco', 2],
    ['staff', 'Household payroll — 6 staff', 'VELORA Payroll', 612000, null, 2],
    ['staff', 'Relief cover — Saint-Barth storm window', 'Caraïbes Personnel', 128000, 'prop_azure', 4],
    ['vehicles', 'Ferrari Roma — battery conditioning & valet', 'Monaco Auto Care', 96000, 'prop_monaco', 3],
    ['vehicles', 'Range Rover — winter tyre changeover', 'Helvetia Wheels', 184000, 'prop_cervin', 5],
    ['vehicles', 'Sprinter VIP — air-con recharge', 'Gustavia Motors', 62000, 'prop_azure', 1],
    ['vehicles', 'Fleet insurance instalment', 'Aon Private & Family Office', 86000, null, 6],
    ['travel', 'Air Culinaire — positioning fee (Monaco sector)', 'Air Culinaire', 380000, null, 1],
    ['travel', 'Le Bourget handling — departure 18 Sept', 'Paris Aeronautique Group', 128000, null, 2],
    ['travel', 'Eurostar Business Premier — 2 passengers', 'Eurostar', 98000, null, 4],
    ['travel', 'Monaco garage — bay 7 extension', 'Cambaces', 32000, 'prop_monaco', 5],
    ['travel', 'Fuel uplift — Al Maktoum (provisional)', 'SkyBridge Aviation', 226000, null, 6],
    ['lifestyle', 'Wine cellar replenishment — Burgundy case', 'Berry Bros & Rudd', 264000, 'prop_belgravia', 3],
    ['lifestyle', 'Floral programme — weekly', 'Maison Lachaume', 68000, 'prop_vauban', 2],
    ['lifestyle', 'Yacht tender hours — held for October', 'Port Hercule Nautic', 96000, null, 5],
    ['lifestyle', 'Memberships — annual instalment', 'Cercle Sport Monaco', 164000, null, 6],
  ];
  const today = now.getUTCDate();
  const isoDay = (day) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), Math.min(day, today)));
    return d.toISOString().slice(0, 10);
  };
  const seen = {};
  currentLines.forEach((line, i) => (seen[line[0]] = seen[line[0]] || []).push(i));
  const totalsByCat = {};
  Object.entries(seen).forEach(([cat, idxs]) => {
    totalsByCat[cat] = idxs.reduce((sum, i) => sum + currentLines[i][3], 0);
  });

  currentLines.forEach(([category_key, description, vendor, amount_cents, property_id, day], i) => {
    let amount = amount_cents;
    const group = seen[category_key];
    const isLast = group[group.length - 1] === i;
    if (isLast && CATEGORY_TARGETS[category_key] !== undefined) {
      amount = CATEGORY_TARGETS[category_key] - (totalsByCat[category_key] - amount_cents);
    }
    const spent_on = isoDay(day);
    expenses.push({
      id: `exp_cur_${i}`,
      user_id: OWNER,
      property_id,
      category_key,
      description,
      vendor,
      amount_cents: amount,
      spent_on,
      status: i % 7 === 0 ? 'pending' : 'recorded',
      requires_review: i % 7 === 0 ? 1 : 0,
      notes: '',
      created_at: new Date(spent_on + 'T09:00:00.000Z').toISOString(),
    });
  });

  /* ---- Previous six months: deterministic history for the charts ---- */
  const historyShape = {
    property_operations: [0.86, 1.0, 0.92, 0.95, 0.97, 1.06],
    staff: [0.98, 1.0, 1.0, 1.0, 1.0, 1.02],
    vehicles: [0.64, 1.18, 0.71, 0.9, 1.42, 1.0],
    travel: [0.52, 1.71, 0.61, 1.34, 0.88, 1.12],
    lifestyle: [0.77, 1.24, 0.9, 1.06, 1.48, 1.0],
    advisers: [0.9, 0.9, 1.4, 0.9, 0.9, 1.15],
  };
  const monthlyVendor = {
    property_operations: ['Island & estate operations', 'Household maintenance desk', 'Utilities & levies', 'Seasonal works'],
    staff: ['VELORA Payroll — household', 'VELORA Payroll — estate management', 'Relief & agency cover', 'Staff travel'],
    vehicles: ['Fleet servicing', 'Insurance instalment', 'Fuel & storage', 'Detailing'],
    travel: ['Aviation management', 'Handling & overflight', 'Ground transfers', 'Rail & hotels'],
    lifestyle: ['Restaurants & clubs', 'Provisioning', 'Experiences', 'Memberships'],
    advisers: ['Legal & tax advisers', 'Private banking fees', 'Insurance — buildings', 'Trustee fees'],
  };
  Object.keys(historyShape).forEach((key) => {
    const target = CATEGORY_TARGETS[key] || 0;
    historyShape[key].forEach((factor, mIdx) => {
      const month = monthStart(now, -(6 - mIdx));
      const total = Math.round((target || 380000) * factor);
      const parts = [0.44, 0.28, 0.18, 0.1];
      parts.forEach((p, pi) => {
        const amount = Math.round(total * p);
        if (amount <= 0) return;
        const d = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 3 + pi * 6, 9));
        expenses.push({
          id: `exp_h_${key}_${mIdx}_${pi}`,
          user_id: OWNER,
          property_id: key === 'property_operations' ? ['prop_azure', 'prop_monaco', 'prop_belgravia', 'prop_vauban'][pi % 4] : null,
          category_key: key,
          description: `${CATEGORIES.find((c) => c[0] === key)[1]} — ${month.toLocaleString('en-GB', { month: 'long' })} ${month.getUTCFullYear()}`,
          vendor: monthlyVendor[key][pi],
          amount_cents: amount,
          status: 'recorded',
          spent_on: d.toISOString().slice(0, 10),
          requires_review: 0,
          notes: '',
          created_at: d.toISOString(),
        });
      });
    });
  });
  expenses.push(
    {
      id: 'exp_henrik_1', user_id: CLIENT2, property_id: 'prop_vaduz', category_key: 'property_operations',
      description: 'Schaanwald — winter preparation', vendor: 'Haas Haustechnik', amount_cents: 384000,
      spent_on: isoDay(Math.max(1, today - 1)), status: 'recorded', requires_review: 0,
      notes: '', created_at: at(now, -5),
    },
    {
      id: 'exp_henrik_2', user_id: CLIENT2, property_id: 'prop_gstaad', category_key: 'property_operations',
      description: 'Edelweiss — scaffolding quote (accepted)', vendor: 'Brunner Fassade', amount_cents: 152000,
      spent_on: isoDay(today), status: 'pending', requires_review: 1,
      notes: '', created_at: at(now, -2),
    },
  );

  /* ----------------------------------------------------------- documents */
  const docSeed = [
    ['Villa Azure — Pool service contract 2026', 'maintenance', 'prop_azure', 'pdf', 1840, 'K. Mensah / Caraïbes Techniques', 3, 12, 'valid', ['contract', 'pool'], 'Renewal notice due before 31 December.'],
    ['Monte Carlo Penthouse — Buildings insurance policy', 'insurance', 'prop_monaco', 'pdf', 6240, 'AIG Private Client', 2, 238, 'valid', ['policy', 'buildings'], 'Sum insured revised at the March valuation.'],
    ['Ferrari Roma — Hull & liability schedule', 'insurance', 'prop_monaco', 'pdf', 980, 'Aon Private', 1, 21, 'expiring', ['vehicle', 'renewal'], 'Renewal decision outstanding.'],
    ['Belgravia Townhouse — Freehold title register', 'real_estate', 'prop_belgravia', 'pdf', 2410, 'Simpsons Estate Agents', 1, null, 'valid', ['title'], 'Official copies dated March 2024.'],
    ['Hôtel Particulier Vauban — Bâtiment de France filings', 'real_estate', 'prop_vauban', 'pdf', 5120, 'Cabinet Vernhes', 4, null, 'valid', ['heritage', 'façade'], 'Constrains external lighting works.'],
    ['A. Ferrand — Employment contract & NDA', 'contracts', 'prop_monaco', 'pdf', 720, 'Private Office', 2, null, 'valid', ['staff', 'nda'], 'Non-solicitation clause runs to 2029.'],
    ['M. Lindqvist — Estate manager retainer', 'contracts', 'prop_monaco', 'pdf', 640, 'VELORA Private Office', 3, null, 'valid', ['staff'], 'Includes on-call protocol for arrivals.'],
    ['Chalet Le Cervin — Cladding works scope & quote', 'maintenance', 'prop_cervin', 'pdf', 1310, 'Atelier Bois Zermatt', 1, 4, 'valid', ['works'], 'Stage 1 invoiced; stage 2 pending completion report.'],
    ['Emirates Hills — Standby services agreement', 'contracts', 'prop_emirates', 'pdf', 890, 'Emaar Community Mgmt', 1, 74, 'valid', ['standby'], 'Suspends automatically on occupancy notice.'],
    ['Villa Azure — Pre-season storm checklist (signed)', 'maintenance', 'prop_azure', 'pdf', 460, 'J-B. Pitre', 1, null, 'valid', ['security'], 'Filed after the 25 August walk-through.'],
    ['Fleet — Q4 insurance instalment invoice', 'invoices', null, 'pdf', 310, 'Aon Private', 1, null, 'valid', ['vehicles'], ''],
    ['Berry Bros & Rudd — Cellar replenishment invoice', 'invoices', 'prop_belgravia', 'pdf', 240, 'Supplier', 1, null, 'expired', ['wine'], 'Paid 3 September; reconciliation complete.'],
    ['SkyBridge Aviation — Management contract', 'contracts', null, 'pdf', 4180, 'Legal — Verrill', 5, 190, 'valid', ['aviation'], 'Annual review meeting in November.'],
    ['Gustavia Motors — Sprinter service report', 'maintenance', 'prop_azure', 'pdf', 520, 'Gustavia Motors', 1, null, 'valid', ['vehicle'], ''],
    ['Monaco — Household staff register & work permits', 'identity', 'prop_monaco', 'pdf', 1650, 'Commissariat', 2, 96, 'valid', ['permits'], 'Two permits require renewal before December.'],
    ['Suppliers — Approved list v9', 'suppliers', null, 'xlsx', 180, 'Private Office', 9, null, 'valid', ['vendors'], 'Reviewed quarterly.'],
    ['Henrik Sund — Gstaad roof survey', 'maintenance', 'prop_gstaad', 'pdf', 2240, 'Brunner Fassade', 1, 3, 'valid', ['survey'], ''],
  ];
  const documents = docSeed.map(([name, category, property_id, file_type, size_kb, owner, version, expiresIn, status, tags, notes], i) => ({
    id: `doc_${i}`,
    user_id: name.startsWith('Henrik') ? CLIENT2 : OWNER,
    property_id,
    name,
    category,
    file_type,
    size_kb,
    version,
    owner,
    tags: JSON.stringify(tags),
    visibility: i % 6 === 0 ? 'advisers' : 'private',
    status,
    expires_at: expiresIn === null ? null : on(now, expiresIn, 0),
    uploaded_at: at(now, -1 - i * 7),
    updated_at: at(now, -(0.2 + (i % 9) * 1.4)),
    notes,
  }));

  /* ------------------------------------------------------- reservations */
  const reservationSeed = [
    ['restaurant', 'Dinner — Le Louis XV', 'Ambassade d’Auguste', 'Monaco', 14, 21, 0, 3, 'requested', null, 'Dress: jacket. Window table requested.', 'prop_monaco'],
    ['restaurant', 'Chef’s counter — Novikov', 'Novikov Monte-Carlo', 'Monaco', -2, 20, 30, 2, 'completed', 'NV-2291', 'Standing request for the first Friday of the month.', 'prop_monaco'],
    ['experience', 'Car collection visit — Talbot Lottingen', 'Lottingen Classics', 'Zurich', 30, 10, 0, 2, 'pending', null, 'Dealer proposed the 3rd; awaiting your calendar.', null],
    ['yacht', 'Tender + mooring — Port Hercule', 'Monaco Yacht Show Ops', 'Monaco', 12, 15, 0, 6, 'confirmed', 'MY-7741', 'Tender crew briefed for the arrival day.', null],
    ['spa', 'Recovery session — Thermes Marins', 'Thermes Marins Monte-Carlo', 'Monaco', 3, 9, 30, 2, 'confirmed', 'TM-5510', '', 'prop_monaco'],
    ['event', 'Fundraiser — Fondation Prince Pierre', 'Fondation', 'Monaco', 9, 19, 30, 2, 'confirmed', 'FPP-118', 'Arrival 20:00, seating with the Marchetti party.', null],
    ['retail', 'Loro Piana — winter fittings', 'Loro Piana Paris', 'Paris', 7, 11, 0, 1, 'pending', null, 'Salon reserved, stylist to attend.', 'prop_vauban'],
    ['aviation', 'Helicopter — Monaco → Nice (contingency)', 'Heli Monaco Air', 'Monaco', 12, 18, 0, 3, 'pending', null, 'Only if the Monaco road corridor is closed.', 'prop_monaco'],
  ];
  const reservations = reservationSeed.map(
    ([kind, title, vendor, city, dayOff, hh, mm, guests, status, reference, notes, property_id], i) => ({
      id: `res_${i}`,
      user_id: OWNER,
      property_id,
      kind,
      title,
      vendor,
      city,
      starts_at: on(now, dayOff, hh, mm),
      guests,
      status,
      reference,
      dress_code: kind === 'restaurant' ? 'Jacket required' : null,
      notes,
      created_at: at(now, -3 - i),
      updated_at: at(now, -(0.3 + (i % 5) * 0.7)),
    }),
  );

  /* ---------------------------------------------------------- AI history */
  const ai_conversations = [
    {
      id: 'conv_command_center',
      user_id: OWNER,
      title: 'Monaco arrival — 18 September',
      channel: 'command_center',
      provider: 'velora-demo',
      model: 'velora-coordinator',
      status: 'open',
      created_at: at(now, -0.35),
      updated_at: at(now, -0.02),
    },
    {
      id: 'conv_expenses',
      user_id: OWNER,
      title: 'This month’s property expenses',
      channel: 'command_center',
      provider: 'velora-demo',
      model: 'velora-coordinator',
      status: 'open',
      created_at: at(now, -1.9),
      updated_at: at(now, -1.85),
    },
    {
      id: 'conv_paris_weekend',
      user_id: OWNER,
      title: 'Prepare my Paris weekend',
      channel: 'command_center',
      provider: 'velora-demo',
      model: 'velora-coordinator',
      status: 'open',
      created_at: at(now, -5.1),
      updated_at: at(now, -5.05),
    },
  ];

  const ai_messages = [
    {
      id: 'msg_1', user_id: OWNER, conversation_id: 'conv_command_center', role: 'user',
      content: 'Prepare everything for my arrival in Monaco.', created_at: at(now, -0.35), payload_json: null,
    },
    {
      id: 'msg_2', user_id: OWNER, conversation_id: 'conv_command_center', role: 'assistant',
      content: 'Arrival plan prepared.',
      created_at: at(now, -0.34),
      payload_json: JSON.stringify({
        blocks: [
          { type: 'kv', label: 'Residence', value: 'Monte Carlo Penthouse' },
          { type: 'kv', label: 'Arrival', value: '18 September — 19:40' },
          { type: 'kv', label: 'Driver', value: 'Confirmed · Maybach S 680' },
          { type: 'kv', label: 'Housekeeping', value: 'Scheduled 16:00' },
          { type: 'kv', label: 'Dinner', value: 'Reservation requested' },
          { type: 'kv', label: 'Vehicle', value: 'Ready · garage bay 7' },
        ],
      }),
    },
    {
      id: 'msg_3', user_id: OWNER, conversation_id: 'conv_expenses', role: 'user',
      content: 'Show me this month’s property expenses.', created_at: at(now, -1.9), payload_json: null,
    },
    {
      id: 'msg_4', user_id: OWNER, conversation_id: 'conv_expenses', role: 'assistant',
      content: 'Recorded property operations this month: €18,462 across 6 entries. Villa Azure grounds and Chalet Le Cervin cladding account for half.',
      created_at: at(now, -1.88), payload_json: null,
    },
    {
      id: 'msg_5', user_id: OWNER, conversation_id: 'conv_paris_weekend', role: 'user',
      content: 'Prepare my Paris weekend.', created_at: at(now, -5.1), payload_json: null,
    },
    {
      id: 'msg_6', user_id: OWNER, conversation_id: 'conv_paris_weekend', role: 'assistant',
      content: 'Vauban prepared for Friday. Two items require confirmation: the Loro Piana fitting time and the chef’s market order.',
      created_at: at(now, -5.08), payload_json: null,
    },
  ];

  const aiTaskSeed = [
    ['Housekeeping scheduled — Monte Carlo Penthouse', 'property', 'confirmed', 0, 0.98, 'Two housekeepers 16:00–19:00, arrival protocol applied.'],
    ['Chauffeur confirmed — 19:40 Le Bourget', 'travel', 'confirmed', 0, 0.97, 'R. Al Nuaimi unavailable; L. Doyle accepted the handover.'],
    ['Dinner reservation — Le Louis XV, 21 Sep', 'lifestyle', 'requires_confirmation', 1, 0.71, 'Action requires confirmation. No booking exists until the restaurant replies.'],
    ['Villa Azure — pool maintenance reminder sent', 'people', 'done', 0, 0.99, 'Message delivered to K. Mensah at 07:12.'],
    ['Grocery provisioning — arrival list', 'lifestyle', 'proposed', 1, 0.82, 'Supplier to be instructed once the list is approved.'],
    ['Security review — arrival perimeter', 'security', 'proposed', 0, 0.9, 'Patrol overlap suggested 19:00–23:00.'],
    ['Vehicle ready — Ferrari moved to bay 6', 'vehicles', 'confirmed', 0, 0.95, 'Battery conditioner left in place at your standing instruction.'],
    ['Staff notification — 4 household members', 'people', 'done', 0, 0.99, 'Arrival notice sent to the estate manager and three department leads.'],
  ];
  const ai_tasks = aiTaskSeed.map(([label, module, status, requires_confirmation, confidence, detail], i) => ({
    id: `ait_${i}`,
    user_id: OWNER,
    conversation_id: 'conv_command_center',
    label,
    module,
    status,
    requires_confirmation,
    confidence,
    detail,
    task_id: status === 'done' ? ['tsk_arrival', 'tsk_driver'][i % 2] : null,
    created_at: at(now, -0.34 + i * 0.001),
    updated_at: at(now, -(0.2 - i * 0.01)),
  }));

  /* ------------------------------------------------------ subscription */
  const subscriptions = [
    {
      id: 'sub_priority',
      user_id: OWNER,
      plan: 'priority',
      status: 'active',
      billing_cycle: 'monthly',
      amount_cents: 49900,
      currency: 'EUR',
      provider: 'demo',
      provider_customer_id: null,
      provider_subscription_id: null,
      current_period_end: on(now, 26, 23, 59),
      cancel_at_period_end: 0,
      started_at: at(now, -365),
      cancelled_at: null,
      updated_at: at(now, -4),
    },
    {
      id: 'sub_private',
      user_id: CLIENT2,
      plan: 'private',
      status: 'past_due',
      billing_cycle: 'monthly',
      amount_cents: 19900,
      currency: 'EUR',
      provider: 'demo',
      current_period_end: on(now, -3, 23, 59),
      cancel_at_period_end: 0,
      started_at: at(now, -90),
      cancelled_at: null,
      updated_at: at(now, -3),
    },
  ];

  const invoices = [];
  for (let i = 5; i >= 0; i -= 1) {
    const m = monthStart(now, -i);
    const m2 = monthStart(now, -i + 1);
    const issued = new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth(), 1, 8));
    invoices.push({
      id: `inv_${i}`,
      user_id: OWNER,
      subscription_id: 'sub_priority',
      number: `VP-2026-${String(m.getUTCMonth() + 1).padStart(2, '0')}-014`,
      description: `VELORA Priority — monthly service fee${i === 0 ? ' (issued for the period ending ' + new Date(m2).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ')' : ''}`,
      amount_cents: 49900,
      currency: 'EUR',
      status: i === 0 ? 'open' : 'paid',
      issued_at: issued.toISOString(),
      paid_at: i === 0 ? null : new Date(issued.getTime() + 2 * DAY).toISOString(),
      receipt_url: null,
    });
  }
  invoices.push({
    id: 'inv_henrik',
    user_id: CLIENT2,
    subscription_id: 'sub_private',
    number: 'VP-2026-09-021',
    description: 'VELORA Private — monthly service fee',
    amount_cents: 19900,
    currency: 'EUR',
    status: 'open',
    issued_at: monthStart(now, 0).toISOString(),
    paid_at: null,
    receipt_url: null,
  });

  /* ------------------------------------------------------- notifications */
  const notifSeed = [
    ['insight', 'Villa Azure maintenance confirmation is still pending', 'Caraïbes Techniques has not acknowledged the 14 September service window.', 'critical', 'Review', '/properties/prop_azure', null],
    ['travel', 'Paris → Monaco — transfer handover at 16:10', 'Maybach S 680 prepared. Chauffeur L. Doyle briefed for Le Bourget.', 'info', 'Open', '/travel', null],
    ['property', 'Chalet Le Cervin — cladding stage 1 invoiced', 'CHF materials and lift hire recorded against the works budget.', 'attention', 'Review', '/properties/prop_cervin', null],
    ['billing', 'Invoice VP-2026-09-014 is open', 'Your monthly service fee is due on the 1st.', 'info', 'View', '/membership', null],
    ['security', 'Supplier escort required for mountain deliveries', 'Access to the north face is restricted until works complete.', 'attention', 'Acknowledge', '/properties/prop_cervin', null],
    ['ai', 'Two AI tasks await your confirmation', 'Dinner reservation and grocery provisioning are held pending your approval.', 'attention', 'Review', '/ai', at(now, -0.05)],
    ['travel', 'London → Paris confirmed', 'Eurostar 9024, Business Premier, platform assistance on both ends.', 'info', null, null, at(now, -1.4)],
    ['system', 'Documents expiring within 30 days', 'Ferrari policy renewal and work-permit renewals are in your documents library.', 'info', 'Open', '/documents', at(now, -2.2)],
  ];
  const notifications = notifSeed.map(([kind, title, body, severity, action_label, action_href, read], i) => ({
    id: `ntf_${i}`,
    user_id: OWNER,
    kind,
    title,
    body,
    severity,
    action_label,
    action_href,
    read_at: read,
    created_at: at(now, -(0.02 + i * 0.35)),
  }));

  /* ------------------------------------------- access requests + tickets */
  const access_requests = [
    ['Aurélie', 'Bonnard', 'a.bonnard@privateoffice.ch', 'Switzerland', 3, 'Property & staff coordination', 'Family office of a single principal; we need one place for five households and their rosters.', 'invited', -1.2],
    ['R.', 'Kaminska', 'rk@k-familyoffice.lu', 'Luxembourg', 6, 'Consolidated reporting', 'We are evaluating private estate tooling for two principals.', 'new', -0.3],
    ['Tobias', 'Frank', 'tfrank@nordsee-cap.de', 'Germany', 2, 'Travel & lifestyle', 'Requested through your members’ referral programme.', 'reviewing', -2.6],
    ['M.', 'Al-Fahim', 'office@alfahimholdings.ae', 'United Arab Emirates', 4, 'Property operations', 'Please contact my office only, in English, between 14:00 and 18:00 GST.', 'new', -0.9],
    ['Cecile', 'Duval', 'c.duval@maisonduval.fr', 'France', 1, 'Staff management', 'Small property group; interested in the Private tier.', 'declined', -8.4],
  ].map(([first_name, last_name, email, country, residences, primary_requirement, message, status, off], i) => ({
    id: `areq_${i}`,
    first_name,
    last_name,
    email,
    country,
    residences,
    primary_requirement,
    message,
    referrer: 'velora.private/landing',
    status,
    reviewer_note: status === 'invited' ? 'Onboarding call held. Trial extended to 30 days.' : null,
    created_at: at(now, off),
    updated_at: at(now, off + 0.1),
  }));

  const tickets = [
    ['Owner portal: missing document for Belgravia', 'The title register appears twice in the library. Can a duplicate be removed on my behalf?', 'normal', 'answered', 'I. Fontaine', 'Removed the duplicate; the 2024 official copy is the record. No action required on your side.', -1.1, -0.2],
    ['Add a fourth garage bay in Monaco', 'Please ask the concierge desk about bay 8 for the arrival in September.', 'high', 'open', null, null, -0.35, -0.35],
    ['Statement of fees for the calendar year', 'My advisers would like a simple statement of what was recorded, not tax advice.', 'low', 'in_review', 'I. Fontaine', null, -4.2, -2.1],
    ['Gstaad — supplier confirmation', 'Scaffolding confirmation still outstanding with Brunner.', 'urgent', 'open', null, null, -0.15, -0.15],
  ].map(([subject, body, priority, status, assignee, reply, cOff, uOff], i) => ({
    id: `tkt_${i}`,
    user_id: i === 3 ? CLIENT2 : OWNER,
    subject,
    body,
    priority,
    status,
    assignee,
    reply,
    created_at: at(now, cOff),
    updated_at: at(now, uOff),
  }));

  const audit_events = [
    ['session.sign_in', null, 'Authentication succeeded from a recognised device.', at(now, -0.02)],
    ['ai.request_created', 'conv_command_center', '8 proposed actions · 2 require confirmation', at(now, -0.34)],
    ['task.created', 'tsk_arrival', 'Created by AI coordinator', at(now, -0.33)],
    ['document.viewed', 'doc_1', 'Metadata only — file not attached in the demo build', at(now, -0.6)],
    ['subscription.viewed', 'sub_priority', 'Billing period displayed', at(now, -1.2)],
    ['session.sign_in', null, 'Device: Linux · Chromium', at(now, -1.9)],
    ['property.updated', 'prop_cervin', 'Status set to maintenance', at(now, -2.1)],
    ['access_request.created', 'areq_1', 'New private access request', at(now, -0.3)],
    ['admin.user_role_changed', 'usr_henrik', 'Role set to owner by I. Fontaine', at(now, -3.4)],
  ].map(([event, target, meta, ts], i) => ({
    id: `aud_${i}`,
    user_id: i === 8 ? ADMIN : i % 4 === 3 ? CLIENT2 : OWNER,
    event,
    target,
    meta,
    created_at: ts,
  }));

  return {
    users,
    properties,
    staff,
    vehicles,
    trips,
    trip_legs,
    expense_categories,
    expenses,
    tasks,
    documents,
    reservations,
    ai_conversations,
    ai_messages,
    ai_tasks,
    subscriptions,
    invoices,
    notifications,
    access_requests,
    tickets,
    audit_events,
    password_resets: [],
  };
}

export const SEED_TABLE_ORDER = [
  'users',
  'properties',
  'staff',
  'vehicles',
  'trips',
  'trip_legs',
  'expense_categories',
  'expenses',
  'tasks',
  'documents',
  'reservations',
  'ai_conversations',
  'ai_messages',
  'ai_tasks',
  'subscriptions',
  'invoices',
  'notifications',
  'access_requests',
  'tickets',
  'audit_events',
];
