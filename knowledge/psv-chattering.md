# PSV Chattering — Causes, Effects, and Prevention

## What is PSV Chattering?

PSV (Pressure Safety Valve) chattering is rapid, repetitive opening and closing of a pressure relief valve that occurs when the valve cannot maintain stable flow. The valve opens, pressure drops below reseating pressure, the valve closes, pressure rises again, and the cycle repeats at high frequency.

Chattering is a serious operational problem that causes mechanical damage and creates a safety hazard.

## Root Causes of Chattering

### 1. Excessive Inlet Pressure Drop
The most common cause. When pressure drop in the inlet piping between the vessel and the valve exceeds approximately 3% of the set pressure:
- Valve opens at set pressure
- Pressure at valve inlet drops rapidly due to inlet piping losses
- Valve sees pressure far below set pressure and attempts to close (blowdown)
- Vessel pressure quickly recovers
- Valve reopens — cycle repeats

**Rule of thumb:** Inlet pressure loss ≤ 3% of set pressure at full rated flow.

**Calculation:**
ΔP_inlet / P_set × 100% ≤ 3%

If inlet ΔP exceeds 3%, consider:
- Larger inlet nozzle diameter
- Shorter inlet piping
- Pilot-operated PRV (immune to inlet loss chattering)

### 2. Oversized Valve
When the installed valve has significantly more capacity than required:
- Valve opens and immediately relieves far more flow than the overpressure source
- Vessel pressure drops below reseating pressure almost instantly
- Valve closes, pressure builds, reopens — chattering cycle

Signs of oversizing:
- Required orifice area is much smaller than installed orifice area
- Utilisation factor < 30–40%

**Prevention:** Size the valve as close to the required area as practical. Utilisation of 60–80% of selected orifice capacity is ideal.

### 3. Hunting / Instability at Low Flow
Some valves exhibit instability when flow is near the minimum stable flow rate. This is particularly common with:
- Conventional spring-loaded valves at low overpressures
- Valves with stiff springs operating near set pressure
- Conditions where process flow is intermittent

### 4. Two-Phase or Condensing Service
Valves in two-phase service may experience:
- Rapid phase transitions at the valve inlet
- Density fluctuations causing flow instability
- Liquid slug ingestion followed by vapour — sudden flow changes cause valve instability

### 5. Back Pressure Oscillations
Pulsating back pressure (from other relieving devices, compressors, etc.) can cause valve instability if the back pressure magnitude approaches blowdown.

## Consequences of Chattering

### Mechanical Damage
- **Disc and seat damage**: Repeated high-velocity impacts between disc and seat cause galling, erosion, and wire-drawing
- **Spring fatigue**: Rapid cycling fatigues the spring, potentially causing set pressure drift
- **Guide wear**: Stem/guide contact during rapid cycling causes wear, eventually causing the valve to stick open or fail to reseat
- **Body erosion**: High-velocity gas/liquid erosion of body and trim

### Operational Consequences
- **Set pressure drift**: Damaged seating surfaces cause the valve to leak at pressures below set pressure
- **Failure to reseat**: Damaged seat may prevent proper reseating, causing continuous leakage
- **Unplanned shutdown**: Continued chattering may require process shutdown for valve replacement

### Safety Consequences
- Structural fatigue of connected piping from vibration
- Potential for valve to fail open or closed at a critical moment
- Noise and vibration hazard to nearby personnel

## Prevention and Mitigation

### Design Phase
1. **Limit inlet pressure drop**: Design inlet nozzle and piping for ≤ 3% ΔP at maximum flow
2. **Proper sizing**: Avoid excessive oversizing; target 60–80% utilisation of selected orifice
3. **Pilot-operated PRV**: Use pilot-operated valves when:
   - Inlet pressure drop cannot be reduced below 3%
   - Operating pressure is close to set pressure (>90% of set)
   - Multiple sources of back pressure variability exist
4. **Valve selection**: Consider valves with adjustable blowdown for services where chattering may occur

### Operational Phase
1. **Regular inspection**: Check valve seat condition; early detection of wear prevents catastrophic failure
2. **Set pressure verification**: Pop test valves regularly to confirm set pressure has not drifted
3. **Root cause investigation**: Any observed chattering should trigger engineering review of inlet piping losses and valve sizing

## Chattering vs. Simmer vs. Flutter

- **Simmer**: Audible hissing from valve at 85–95% of set pressure; indicates valve is approaching set. Not chattering.
- **Flutter (Feathering)**: Valve disc vibrates at high frequency without fully opening. Occurs near set pressure. Less severe than chattering.
- **Chattering**: Repeated full (or substantial) opening and closing. Most severe and damaging.
- **Blowdown**: Normal reseating; valve closes after pressure drops 7–10% below set. Not a problem.

## Relevant Standards

- API 520 Part II: Installation requirements to prevent chattering (§5.2 on inlet pressure drop)
- API 521: System design considerations
- API 576: Inspection of pressure-relieving devices — includes guidance on detecting and evaluating chattering damage
- ASME PTC 25: PRV performance testing standard
