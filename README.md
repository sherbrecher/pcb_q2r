# Overview

PCB Q2R (Quote 2 Rules) is a Mozilla Firefox Extension that analyses the online quotes of different PCB manufacturing services (e.g. JLCPCB) and creates design rule configurations for different EDA tools (e.g. KiCAD).

PCB Q2R is under development and might still contain various bugs.

The project is licensed as [AS-IS](https://github.com/sherbrecher/pcb_q2r/LICENSE.md).

To report a problem or a security vulnerability please [raise an issue](https://github.com/sherbrecher/pcb_q2r/issues).

# Setup

## Requirements

- Mozilla Firefox (136.0.1) or newer

## Installation

### Install as official Add-on

- not yet available

### Install as temporary Add-on

- Open "about:debugging#/runtime/this-firefox"
- Click "Load Temporary Add-on..."
- Select "manifest.json"

## Configuration

- Open "about:addons"
- Click "PCB Q2R"
- Click "Permissions"
- Enable all domains where the quote should be analyzed

## Usage

- Configure online quote on the manufacturers website
- Click "Extensions" in menubar
- Click "PCB Q2R"
- Select PCB manufacturer and EDA tool
- Click "Generate & Download"
- Import design rules in your EDA tool

# Currently supported PCB manufacturing services

## JLCPCB

- Quote website (https://cart.jlcpcb.com/quote)
- Standard/Advanced Rigid PCBs
- Manufacturer Stackups for impedance controlled designs
  - For impedance controlled designs select "FR-4 TG155" and not "FR4-Standard TG 135-140" as JLCPCB does not specify permittivity for that.

## PCBWay

- Quote website (https://www.pcbway.com/orderonline.aspx)
- Standard/Advanced Rigid PCBs
- Manufacturer Stackups for impedance controlled designs

# Currently supported EDA tools

## KiCad

- Open your KiCAD project
- Open PCB file
- Open "File" > "Board Setup..."
- Click "Import Settings from Another Board..."

# ToDos

- Create PDF, HTML or similar of configured quote and store in created design rules package for traceability
- Add possibility to reopen preconfigured quote afterwards (however this can be done)
- Add more PCB manufacturing services
- Add more EDA tools (e.g. Altium)