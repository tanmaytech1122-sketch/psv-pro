# PSV / PRV Engineering Terminology

## Valve Types

### PSV — Pressure Safety Valve
A spring-loaded automatic pressure-relieving device used for steam, gas, and vapour service. Characterized by a rapid, full-opening "pop" action. Primarily used on steam boilers and pressure vessels per ASME code.

### PRV — Pressure Relief Valve
A spring-loaded automatic pressure-relieving device with proportional opening action. Used for liquid service or where proportional relief is acceptable. Opens gradually as pressure increases above set pressure.

### Safety Relief Valve (SRV)
A valve that combines characteristics of both PSV and PRV; can operate in either pop-action or proportional mode depending on service. Common in process industry applications.

### Rupture Disk (Bursting Disk)
A non-reclosing pressure relief device consisting of a thin membrane that ruptures at a predetermined pressure. Often used in combination with PRVs for:
- Toxic service (prevent leakage through PRV)
- Polymers or solids that could foul PRV seat
- Very high set pressures
- Back-up protection downstream of PRV

### Pilot-Operated PRV (POPRV)
A PRV where a small pilot valve senses system pressure and controls the opening/closing of the main valve. Advantages:
- Set pressure can be up to 98% of MAWP
- Immune to back pressure effects
- No chattering from inlet pressure loss
- Tight shutoff

## Pressure Definitions

### MAWP — Maximum Allowable Working Pressure
The maximum gauge pressure permissible at the top of the completed vessel in its normal operating position at the designated coincident temperature. Set by ASME Code Section VIII.

### Design Pressure
The pressure used in the design calculation of the vessel. Usually equals MAWP. May include safety margins above operating pressure.

### Operating Pressure
The pressure at which the vessel normally operates. Should be at least 10% or 25 psi (whichever is greater) below set pressure to avoid nuisance lifting.

### Set Pressure (Ps)
The gauge pressure at which a PRV is set to open. For the inlet of the valve. Marked on the valve nameplate.

### Relieving Pressure (P1)
The actual inlet pressure during relief:
- Single valve: P1 = Ps × (1 + overpressure fraction)
- Fire case: P1 = Ps × 1.21 (21% overpressure)
- Other cases: P1 = Ps × 1.10 (10% overpressure, or 3 psi minimum)

### Accumulation
The pressure increase above MAWP during a relief event. ASME Code limits:
- Non-fire case: 10% accumulation (one valve) or 16% (multiple valves)
- Fire case: 21% accumulation

### Overpressure
Pressure increase above set pressure during valve operation. Usually expressed as % of set pressure.
- Single valve: typically 10%
- Multiple valves: first at design, others up to 16% above MAWP
- Fire case: 21%

### Back Pressure (P2)
Pressure at the valve outlet during discharge. Has two components:
- **Built-up back pressure**: Pressure created by flow through discharge piping/flare system
- **Superimposed back pressure**: Static pressure existing in discharge system before valve opens

### Blowdown
The reduction in inlet pressure below set pressure before the valve reseats. Typically 7–10% of set pressure. A valve set at 100 psig with 10% blowdown reseats at 90 psig.

## Capacity and Sizing Terms

### Required Relief Rate (W)
The mass flow or volumetric flow that must be relieved to prevent accumulation above the allowable limit. Determined by the governing overpressure scenario.

### Rated Capacity
The flow capacity of a specific PRV at a specific set pressure, as certified by the manufacturer and ASME (for US codes).

### Coefficient of Discharge (Kd)
A dimensionless factor accounting for actual vs. theoretical flow through the valve orifice. For ASME-certified valves, Kd = 0.975 for gas/vapour and steam, 0.65 for liquid service.

### Effective Discharge Area (A)
The calculated minimum orifice area required for a specific relief duty. Used to select the next larger standard API 526 orifice.

### Utilisation Factor
The ratio of required area to selected orifice area, expressed as a percentage:
Utilisation = A_required / A_selected × 100%
Typical target: 60–80% utilisation. Very low utilisation (<30%) indicates potential oversizing.

## Correction Factors

### Kb — Back Pressure Correction Factor
Accounts for reduced capacity due to back pressure. Applied in gas/vapour and steam sizing:
- Conventional valves: reduces below 1.0 when back pressure > 10% of set pressure
- Balanced bellows valves: reduces below 1.0 when back pressure > 50% of set pressure
- Pilot-operated valves: Kb = 1.0 regardless

### Kd — Effective Coefficient of Discharge
Accounts for real valve flow vs. ideal orifice flow. Standard values:
- Gas/vapour and steam: Kd = 0.975
- Liquid: Kd = 0.65

### Kc — Combination Correction Factor
Applied when a rupture disk is installed upstream of a PRV. Kc = 0.9 (unless the combined PRV/disk assembly is tested and certified together, in which case Kc = 1.0).

### Ksh — Superheat Correction Factor for Steam
Reduces steam capacity below saturated steam capacity for superheated steam. Read from API 520 Table 10 based on relieving pressure and superheat temperature. Ksh = 1.0 for saturated steam.

### Kn — Napier Correction Factor
Applied to steam sizing at high pressures (above 1500 psia). Accounts for deviation from Napier equation at high pressures.

### Kv — Viscosity Correction Factor
Applied only to liquid sizing. Accounts for reduced discharge coefficient at low Reynolds numbers (high viscosity liquids). Iterate between area and Reynolds number until convergence.

### Kw — Back Pressure Correction for Liquid
Correction factor for liquid service with significant back pressure. Kw = 1.0 for conventional valves regardless of back pressure.

## Fluid Properties

### k — Ratio of Specific Heats (Cp/Cv)
Used in gas/vapour sizing. Affects the C constant and critical pressure ratio:
- Monatomic gases (He, Ar): k ≈ 1.67
- Diatomic gases (N2, H2, air): k ≈ 1.40
- CO2, H2S: k ≈ 1.29
- Propane, propylene: k ≈ 1.13–1.15
- Steam: k ≈ 1.31 (saturated), varies for superheated

### Z — Compressibility Factor
Deviation of real gas from ideal gas behaviour. Z = 1 for ideal gas:
- Low pressure gases: Z ≈ 0.95–1.0
- High pressure gases: Z can be significantly < 1.0
- Near critical point: Z can deviate greatly from 1.0
Calculated using Peng-Robinson or other equation of state.

### MW — Molecular Weight
Molecular weight of the relieving fluid. Used in gas sizing formula:
- Air: MW = 29
- Steam/water: MW = 18
- Methane (CH4): MW = 16
- Propane (C3H8): MW = 44
- Propylene (C3H6): MW = 42
- Hydrogen: MW = 2
- CO2: MW = 44
- H2S: MW = 34

## Standards and Codes

### API 520
Sizing, Selection, and Installation of Pressure-Relieving Devices. Part I: Sizing and Selection. Part II: Installation.

### API 521
Pressure-Relieving and Depressuring Systems. Covers overpressure scenarios, flare system design, and depressurisation.

### API 526
Flanged Steel Pressure Relief Valves. Defines standard face-to-face dimensions, orifice areas, and pressure-temperature ratings for standard PRVs.

### API 527
Seat Tightness of Pressure Relief Valves. Defines acceptable seat leakage rates.

### API 576
Inspection of Pressure-Relieving Devices. Covers maintenance, inspection, and testing intervals.

### ASME Section I
Power Boiler Code. Governs PRVs on steam boilers.

### ASME Section VIII
Pressure Vessel Code. Governs PRVs on unfired pressure vessels in most industrial applications.

### NFPA 58
Liquefied Petroleum Gas Code. Covers PRVs on LPG storage and handling equipment.
