# This is the database schema for the project

### Supabase Database Schema Summary (Sustainable Smart Home)

#### `profiles`

* Tracks each user's profile and configuration status.
* Includes location data: `city`, `state`, `zone_key`, `lat`, `long`.
* `configured` boolean indicates if the user has completed device setup.
* `updated_at` tracks last change.

---

### Devices

#### `devices`

* Core registry for all energy-relevant devices.
* Fields: `id`, `user_id`, `name`, `type` (`solar_array`, `battery`, `ev`, `grid`, `house`), `updated_at`, `is_active`.

#### `battery_config`

* Linked by `device_id`.
* Stores `capacity_kwh`, `max_flow_kw`, `updated_at`.

#### `battery_state`

* Tracks state of charge for each battery.
* Fields: `device_id`, `soc_percent`, `soc_kwh`, `timestamp`, `updated_at`.

#### `ev_config`

* Linked by `device_id`.
* Stores EV settings: `battery_capacity_kwh`, `target_charge`, `departure_time`, `charger_power_kw`, `updated_at`.

#### `solar_config`

* Linked by `device_id`.
* Tracks number of panels and output per panel: `panel_count`, `output_per_panel_kw`, `updated_at`.

---

### Energy & Power Flows

#### `power_generation`

* Records energy generation from renewable sources (solar, wind, etc.).
* Fields: `user_id`, `device_id`, `energy_kwh`, `timestamp`, `resolution`, `weather_factor`, `efficiency_factor`, `irradiance_factor`, `updated_at`.

#### `energy_flows`

* Records power transfers between devices.
* Fields: `user_id`, `source_device_id`, `target_device_id`, `source`, `target`, `energy_kwh`, `timestamp`, `resolution`, `updated_at`.

#### `house_load`

* Records home power consumption.
* Fields: `user_id`, `energy_kwh`, `timestamp`, `resolution`, `hypothetical_co2_g`, `updated_at`.

#### `ev_charge_sessions`

* Per-session EV charging log when plugged in.
* Tracks energy from solar, battery, grid.
* Fields: `user_id`, `device_id`, `soc_percent`, energy sources (`_from_solar`, `_from_grid`, `_from_battery`), `plugged_in`, `timestamp`, `resolution`, `updated_at`.

---

### Grid

#### `grid_data`

* Time-series data about grid carbon intensity.
* Fields: `timestamp`, `grid_carbon_intensity`, `zone`, `updated_at`.

---

### Row-Level Security (RLS)

* **Per-user RLS** enabled and enforced for all sensitive tables.
* Config tables (e.g. `battery_config`) use device ownership to infer access.
* `grid_data` is read-only and globally accessible.