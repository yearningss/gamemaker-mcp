# GameMaker MCP Runtime - Tool Reference

Reference for the core runtime categories. See [the runtime guide](../README.md#tool-categories) for the complete catalog of 247 tools across 40 categories.

---

## Table of Contents

1. [Project (6 tools)](#1-project)
2. [Instance (10 tools)](#2-instance)
3. [Room (7 tools)](#3-room)
4. [Variable (6 tools)](#4-variable)
5. [Debug (4 tools)](#5-debug)
6. [Input (7 tools)](#6-input)
7. [Screenshot (6 tools)](#7-screenshot)
8. [Audio (6 tools)](#8-audio)
9. [Layer (6 tools)](#9-layer)
10. [Tilemap (6 tools)](#10-tilemap)
11. [Camera (6 tools)](#11-camera)
12. [Surface (5 tools)](#12-surface)
13. [Particle (6 tools)](#13-particle)
14. [Physics (6 tools)](#14-physics)
15. [Data Structures (6 tools)](#15-data-structures)
16. [Game Control (6 tools)](#16-game-control)
17. [Alarm (4 tools)](#17-alarm)
18. [Animation (6 tools)](#18-animation)
19. [Collision (5 tools)](#19-collision)
20. [Profiling (4 tools)](#20-profiling)

---

## 1. Project

Tools for inspecting GameMaker project structure, resource trees, and configuration.

### `get_project_info`

Returns metadata about the currently running GameMaker project.

**Parameters:** None

**Returns:** Project name, GameMaker version, target platform, config name, display name, and project directory path.

---

### `get_resource_tree`

Retrieves the full resource tree of the project, including all folders and assets.

**Parameters:**
- `filter` (string, optional) — Filter by resource type (e.g., `"sprites"`, `"objects"`, `"rooms"`)

**Returns:** Hierarchical tree of project resources grouped by type (sprites, objects, rooms, scripts, fonts, sounds, etc.).

---

### `search_resources`

Searches project resources by name using a substring or pattern match.

**Parameters:**
- `query` (string, required) — Search string or glob pattern to match against resource names
- `type` (string, optional) — Restrict search to a specific resource type

**Returns:** Array of matching resources with their name, type, and path in the resource tree.

---

### `get_room_order`

Returns the ordered list of rooms as defined in the project room order.

**Parameters:** None

**Returns:** Array of room names in their defined order, with the first room marked as the starting room.

---

### `get_config_info`

Returns the current build configuration and macro definitions.

**Parameters:** None

**Returns:** Active config name, parent config chain, and all defined macros for the active configuration.

---

### `get_resource_count`

Returns a count of resources in the project, optionally broken down by type.

**Parameters:**
- `type` (string, optional) — Count only a specific resource type

**Returns:** Total resource count or per-type breakdown with counts for sprites, objects, rooms, scripts, sounds, fonts, paths, timelines, tilesets, shaders, sequences, and animation curves.

---

## 2. Instance

Tools for inspecting and manipulating runtime object instances.

### `get_all_instances`

Returns a list of all active instances in the current room.

**Parameters:**
- `limit` (number, optional) — Maximum number of instances to return (default: 100)
- `offset` (number, optional) — Offset for pagination

**Returns:** Array of instances with their id, object_index name, x, y, layer, and visible status.

---

### `get_instance_info`

Returns detailed information about a specific instance.

**Parameters:**
- `instance_id` (number, required) — The unique instance ID

**Returns:** Full instance details including id, object name, position (x, y), sprite, image_index, image_speed, depth/layer, visible, persistent, solid, physics-enabled, bounding box, and mask info.

---

### `find_instances_by_object`

Finds all active instances of a given object type.

**Parameters:**
- `object_name` (string, required) — The object resource name (e.g., `"obj_player"`)

**Returns:** Array of instances matching the object type, each with id, x, y, layer, and visible status.

---

### `get_instance_variables`

Retrieves all custom (user-defined) variables on an instance.

**Parameters:**
- `instance_id` (number, required) — The unique instance ID

**Returns:** Object containing all variable names and their current values for the specified instance.

---

### `set_instance_variable`

Sets a variable on a specific instance.

**Parameters:**
- `instance_id` (number, required) — The unique instance ID
- `variable` (string, required) — Variable name to set
- `value` (any, required) — Value to assign (number, string, or boolean)

**Returns:** Confirmation with the previous value and the new value that was set.

---

### `create_instance`

Creates a new instance of an object in the current room.

**Parameters:**
- `object_name` (string, required) — The object resource name to instantiate
- `x` (number, required) — X position
- `y` (number, required) — Y position
- `layer` (string, optional) — Layer name to create on (defaults to the first instance layer)
- `variables` (object, optional) — Initial variable values to set on the instance

**Returns:** The newly created instance's ID, object name, and position.

---

### `destroy_instance`

Destroys an instance, removing it from the room.

**Parameters:**
- `instance_id` (number, required) — The unique instance ID to destroy

**Returns:** Confirmation that the instance was destroyed, along with the object type it was.

---

### `move_instance`

Instantly moves an instance to a new position.

**Parameters:**
- `instance_id` (number, required) — The unique instance ID
- `x` (number, required) — New X position
- `y` (number, required) — New Y position

**Returns:** Confirmation with the previous position and new position.

---

### `get_instance_count`

Returns the number of active instances, optionally filtered by object type.

**Parameters:**
- `object_name` (string, optional) — Count only instances of this object type

**Returns:** The total instance count (or count for the specified object).

---

### `find_nearest_instance`

Finds the nearest instance of a given object type to a point.

**Parameters:**
- `x` (number, required) — Reference X position
- `y` (number, required) — Reference Y position
- `object_name` (string, required) — The object type to search for

**Returns:** The nearest instance's ID, position, and distance from the reference point.

---

## 3. Room

Tools for room inspection, navigation, and viewport queries.

### `get_current_room`

Returns the name and index of the currently active room.

**Parameters:** None

**Returns:** Room name, room index, room width, room height, and whether it is persistent.

---

### `get_room_info`

Returns detailed information about a specific room.

**Parameters:**
- `room_name` (string, required) — The room resource name

**Returns:** Room name, index, width, height, creation code status, persistent flag, layer list, and instance count.

---

### `goto_room`

Transitions the game to a specified room.

**Parameters:**
- `room_name` (string, required) — The room resource name to navigate to

**Returns:** Confirmation that the room transition was initiated, with the target room name.

---

### `restart_room`

Restarts the current room, re-running all creation code and resetting non-persistent instances.

**Parameters:** None

**Returns:** Confirmation that the room restart was initiated.

---

### `get_room_instances`

Returns all instances placed in a room at design time (room editor instances).

**Parameters:**
- `room_name` (string, optional) — Room name (defaults to current room)

**Returns:** Array of instance definitions with object name, x, y, creation code flag, and layer.

---

### `get_room_list`

Returns a list of all rooms in the project.

**Parameters:** None

**Returns:** Array of room names and their indices.

---

### `room_get_viewport`

Returns viewport configuration for the current room.

**Parameters:**
- `viewport_index` (number, optional) — Viewport index 0-7 (default: 0)

**Returns:** Viewport visibility, camera ID, x/y position on screen, width/height on screen, and the associated camera's position and size.

---

## 4. Variable

Tools for reading and writing global and instance variables and variable watching.

### `get_global_variables`

Returns all user-defined global variables.

**Parameters:** None

**Returns:** Object containing all global variable names and their current values.

---

### `set_global_variable`

Sets a global variable to a new value.

**Parameters:**
- `variable` (string, required) — Global variable name
- `value` (any, required) — Value to assign

**Returns:** Confirmation with the previous value and the new value.

---

### `get_instance_variable_value`

Reads a single variable from a specific instance.

**Parameters:**
- `instance_id` (number, required) — The unique instance ID
- `variable` (string, required) — Variable name to read

**Returns:** The current value and its GML type.

---

### `get_built_in_variables`

Returns all built-in GameMaker variables for an instance (x, y, speed, direction, sprite_index, etc.).

**Parameters:**
- `instance_id` (number, required) — The unique instance ID

**Returns:** Object with all built-in variable names and their current values.

---

### `watch_variable`

Registers a variable to be monitored, reporting its value each step or on change.

**Parameters:**
- `instance_id` (number, required) — The instance to watch
- `variable` (string, required) — Variable name to watch
- `on_change_only` (boolean, optional) — If true, only report when value changes (default: true)

**Returns:** Confirmation that the watch was registered, with a watch ID for later removal.

---

### `get_variable_type`

Returns the GML type of a variable's current value.

**Parameters:**
- `instance_id` (number, required) — The unique instance ID
- `variable` (string, required) — Variable name to inspect

**Returns:** The GML type name (e.g., `"number"`, `"string"`, `"array"`, `"struct"`, `"undefined"`).

---

## 5. Debug

Tools for FPS, frame timing, the debug overlay, and error logs.

### `get_fps`

Returns the current frames-per-second of the running game.

**Parameters:** None

**Returns:** Current FPS (real) and target FPS (game_get_speed).

---

### `get_step_time`

Returns timing information for the most recent game step.

**Parameters:** None

**Returns:** Total step time in microseconds, broken down by event type (step, draw, create, etc.).

---

### `show_debug_overlay`

Toggles the built-in GameMaker debug overlay on or off.

**Parameters:**
- `visible` (boolean, required) — Whether to show or hide the overlay

**Returns:** Confirmation of the new overlay visibility state.

---

### `get_error_log`

Retrieves recent errors and warnings from the game runtime.

**Parameters:**
- `limit` (number, optional) — Maximum number of log entries to return (default: 50)

**Returns:** Array of log entries with timestamp, severity (error/warning/info), and message text.

---

## 6. Input

Tools for simulating keyboard, mouse, and gamepad input to the running game.

### `simulate_key_press`

Simulates pressing a keyboard key down.

**Parameters:**
- `key` (string, required) — Key name or virtual key code (e.g., `"vk_left"`, `"A"`, `"vk_space"`)

**Returns:** Confirmation that the key press was simulated.

---

### `simulate_key_release`

Simulates releasing a keyboard key.

**Parameters:**
- `key` (string, required) — Key name or virtual key code

**Returns:** Confirmation that the key release was simulated.

---

### `simulate_mouse_move`

Moves the simulated mouse cursor to a position.

**Parameters:**
- `x` (number, required) — Target X position
- `y` (number, required) — Target Y position
- `gui` (boolean, optional) — If true, coordinates are in GUI space (default: false)

**Returns:** Confirmation with the new mouse position.

---

### `simulate_mouse_click`

Simulates a mouse button click at a position.

**Parameters:**
- `button` (string, required) — Mouse button: `"left"`, `"right"`, or `"middle"`
- `x` (number, required) — Click X position
- `y` (number, required) — Click Y position
- `gui` (boolean, optional) — If true, coordinates are in GUI space (default: false)

**Returns:** Confirmation of the click with button and position.

---

### `simulate_mouse_wheel`

Simulates a mouse wheel scroll event.

**Parameters:**
- `delta` (number, required) — Scroll amount (positive = up, negative = down)

**Returns:** Confirmation of the scroll event.

---

### `simulate_gamepad`

Simulates gamepad input (buttons and axes).

**Parameters:**
- `pad_index` (number, optional) — Gamepad index 0-3 (default: 0)
- `button` (string, optional) — Gamepad button name (e.g., `"gp_face1"`, `"gp_shoulderl"`)
- `axis` (string, optional) — Axis name (e.g., `"gp_axislh"`, `"gp_axislv"`)
- `value` (number, optional) — Axis value from -1 to 1, or 1 for button press / 0 for release

**Returns:** Confirmation of the simulated gamepad input.

---

### `simulate_input_sequence`

Executes a timed sequence of input events (for automated testing).

**Parameters:**
- `sequence` (array, required) — Array of input steps, each with `action` (string), `params` (object), and `delay_ms` (number)

**Returns:** Confirmation that the sequence was started, with total duration and step count.

---

## 7. Screenshot

Tools for capturing screenshots, surfaces, and recording video from the running game.

### `get_game_screenshot`

Captures a screenshot of the game application surface.

**Parameters:**
- `format` (string, optional) — Image format: `"png"` or `"jpg"` (default: `"png"`)
- `scale` (number, optional) — Scale factor 0.1-1.0 (default: 1.0)

**Returns:** Base64-encoded image data with width, height, and format metadata.

---

### `get_gui_screenshot`

Captures a screenshot of the GUI layer only.

**Parameters:**
- `format` (string, optional) — Image format: `"png"` or `"jpg"` (default: `"png"`)

**Returns:** Base64-encoded image data of the GUI layer.

---

### `get_surface_screenshot`

Captures the contents of a specific surface.

**Parameters:**
- `surface_name` (string, required) — Name or ID of the surface to capture
- `format` (string, optional) — Image format: `"png"` or `"jpg"` (default: `"png"`)

**Returns:** Base64-encoded image data of the specified surface.

---

### `compare_screenshots`

Compares two screenshots and returns a diff analysis.

**Parameters:**
- `image_a` (string, required) — Base64-encoded first image
- `image_b` (string, required) — Base64-encoded second image
- `threshold` (number, optional) — Pixel difference threshold 0-255 (default: 10)

**Returns:** Similarity percentage, number of different pixels, and a base64-encoded diff image highlighting changes.

---

### `start_recording`

Starts recording frames from the game at regular intervals.

**Parameters:**
- `interval_ms` (number, optional) — Capture interval in milliseconds (default: 1000)
- `format` (string, optional) — Image format per frame (default: `"png"`)

**Returns:** Confirmation that recording started, with a recording session ID.

---

### `stop_recording`

Stops an active recording session and returns the captured frames.

**Parameters:**
- `session_id` (string, optional) — Recording session ID (defaults to most recent)

**Returns:** Array of captured frames with timestamps and base64-encoded image data.

---

## 8. Audio

Tools for inspecting and controlling audio playback in the running game.

### `get_playing_sounds`

Returns a list of all currently playing sound instances.

**Parameters:** None

**Returns:** Array of playing sounds with sound name, instance ID, volume, pitch, position, looping status, and playback progress.

---

### `play_sound`

Plays a sound resource.

**Parameters:**
- `sound_name` (string, required) — Sound resource name (e.g., `"snd_jump"`)
- `loop` (boolean, optional) — Whether to loop (default: false)
- `volume` (number, optional) — Volume 0.0-1.0 (default: 1.0)
- `pitch` (number, optional) — Pitch multiplier (default: 1.0)

**Returns:** The sound instance ID for the newly playing sound.

---

### `stop_sound`

Stops a specific sound instance.

**Parameters:**
- `sound_instance` (number, required) — Sound instance ID to stop

**Returns:** Confirmation that the sound was stopped.

---

### `set_sound_volume`

Changes the volume of a playing sound instance.

**Parameters:**
- `sound_instance` (number, required) — Sound instance ID
- `volume` (number, required) — New volume 0.0-1.0

**Returns:** Confirmation with the previous and new volume.

---

### `get_audio_info`

Returns global audio system information.

**Parameters:** None

**Returns:** Audio listener position, master volume, number of active channels, and audio group details.

---

### `stop_all_sounds`

Stops all currently playing sounds.

**Parameters:** None

**Returns:** Confirmation with the number of sounds that were stopped.

---

## 9. Layer

Tools for inspecting and manipulating room layers at runtime.

### `get_layers`

Returns all layers in the current room.

**Parameters:** None

**Returns:** Array of layers with name, depth, type (instance, tilemap, background, asset, effect), visibility, and element count.

---

### `get_layer_instances`

Returns all instances on a specific layer.

**Parameters:**
- `layer_name` (string, required) — Layer name

**Returns:** Array of instances on the layer with id, object name, x, y, and visible status.

---

### `get_layer_elements`

Returns all elements (tiles, backgrounds, sprites) on a layer.

**Parameters:**
- `layer_name` (string, required) — Layer name

**Returns:** Array of elements with their type, position, and type-specific properties.

---

### `set_layer_visible`

Shows or hides a layer.

**Parameters:**
- `layer_name` (string, required) — Layer name
- `visible` (boolean, required) — Whether the layer should be visible

**Returns:** Confirmation of the new visibility state.

---

### `set_layer_depth`

Changes the depth of a layer, affecting draw order.

**Parameters:**
- `layer_name` (string, required) — Layer name
- `depth` (number, required) — New depth value

**Returns:** Confirmation with previous and new depth values.

---

### `get_layer_info`

Returns detailed information about a specific layer.

**Parameters:**
- `layer_name` (string, required) — Layer name

**Returns:** Layer name, ID, depth, type, visibility, x/y offset, horizontal/vertical speed, and element count.

---

## 10. Tilemap

Tools for reading and modifying tilemap data at runtime.

### `get_tilemap_data`

Returns the full tile data for a tilemap layer.

**Parameters:**
- `layer_name` (string, required) — Tilemap layer name
- `region` (object, optional) — Sub-region to read: `{ x, y, width, height }` in tile coordinates

**Returns:** 2D array of tile data values, tilemap width/height in tiles, and tile dimensions.

---

### `set_tilemap_cell`

Sets a single tile cell in a tilemap.

**Parameters:**
- `layer_name` (string, required) — Tilemap layer name
- `cell_x` (number, required) — Tile X coordinate
- `cell_y` (number, required) — Tile Y coordinate
- `tile_data` (number, required) — Tile data value (tile index + flags)

**Returns:** Confirmation with previous and new tile data values.

---

### `get_tilemap_info`

Returns metadata about a tilemap layer.

**Parameters:**
- `layer_name` (string, required) — Tilemap layer name

**Returns:** Tileset name, tile width, tile height, map width (in tiles), map height (in tiles), and total tile count.

---

### `clear_tilemap`

Clears all tiles in a tilemap layer, setting them to 0.

**Parameters:**
- `layer_name` (string, required) — Tilemap layer name

**Returns:** Confirmation that the tilemap was cleared.

---

### `get_tileset_info`

Returns information about a tileset resource.

**Parameters:**
- `tileset_name` (string, required) — Tileset resource name

**Returns:** Tileset name, source sprite, tile width, tile height, tile count, columns, and tile horizontal/vertical separation.

---

### `fill_tilemap_region`

Fills a rectangular region of a tilemap with a tile value.

**Parameters:**
- `layer_name` (string, required) — Tilemap layer name
- `x` (number, required) — Start tile X
- `y` (number, required) — Start tile Y
- `width` (number, required) — Region width in tiles
- `height` (number, required) — Region height in tiles
- `tile_data` (number, required) — Tile data value to fill with

**Returns:** Confirmation with the number of tiles filled.

---

## 11. Camera

Tools for inspecting and controlling cameras and views.

### `get_camera_info`

Returns information about a camera.

**Parameters:**
- `camera_id` (number, optional) — Camera ID (defaults to the current view camera)

**Returns:** Camera x, y, width, height, angle, and any scripts assigned to the camera (update, begin, end).

---

### `set_camera_position`

Moves a camera to a new position.

**Parameters:**
- `x` (number, required) — New camera X position
- `y` (number, required) — New camera Y position
- `camera_id` (number, optional) — Camera ID (defaults to current view camera)

**Returns:** Confirmation with previous and new position.

---

### `set_camera_size`

Changes the view size of a camera.

**Parameters:**
- `width` (number, required) — New view width
- `height` (number, required) — New view height
- `camera_id` (number, optional) — Camera ID (defaults to current view camera)

**Returns:** Confirmation with previous and new size.

---

### `camera_shake`

Applies a screen shake effect to the camera.

**Parameters:**
- `intensity` (number, required) — Shake intensity in pixels
- `duration_ms` (number, required) — Duration in milliseconds
- `camera_id` (number, optional) — Camera ID (defaults to current view camera)

**Returns:** Confirmation that the shake effect was applied.

---

### `follow_instance`

Sets a camera to follow a specific instance.

**Parameters:**
- `instance_id` (number, required) — Instance to follow
- `camera_id` (number, optional) — Camera ID (defaults to current view camera)
- `lerp` (number, optional) — Smoothing factor 0.0-1.0 (default: 1.0 for instant)

**Returns:** Confirmation that the camera is now following the instance.

---

### `get_view_info`

Returns information about all enabled views in the current room.

**Parameters:** None

**Returns:** Array of enabled views with viewport index, camera ID, view position and size, port position and size, and visible flag.

---

## 12. Surface

Tools for inspecting, capturing, and managing GPU surfaces.

### `list_surfaces`

Returns a list of all currently existing surfaces.

**Parameters:** None

**Returns:** Array of surfaces with name/ID, width, height, and whether they are the application surface.

---

### `get_surface_info`

Returns detailed information about a specific surface.

**Parameters:**
- `surface_id` (number, required) — Surface ID or name

**Returns:** Surface width, height, depth disabled flag, texture ID, and whether it exists.

---

### `capture_surface`

Captures the pixel contents of a surface as an image.

**Parameters:**
- `surface_id` (number, required) — Surface ID
- `format` (string, optional) — Image format: `"png"` or `"jpg"` (default: `"png"`)

**Returns:** Base64-encoded image data of the surface contents.

---

### `create_surface`

Creates a new surface with the specified dimensions.

**Parameters:**
- `width` (number, required) — Surface width in pixels
- `height` (number, required) — Surface height in pixels
- `name` (string, optional) — Optional name to identify the surface

**Returns:** The new surface ID.

---

### `free_surface`

Frees (destroys) a surface, releasing its GPU memory.

**Parameters:**
- `surface_id` (number, required) — Surface ID to free

**Returns:** Confirmation that the surface was freed.

---

## 13. Particle

Tools for inspecting and controlling the particle system at runtime.

### `get_particle_systems`

Returns a list of all active particle systems.

**Parameters:** None

**Returns:** Array of particle systems with ID, position, draw order, auto-update/draw flags, and particle count.

---

### `create_particle_system`

Creates a new particle system.

**Parameters:**
- `layer_name` (string, required) — Layer to create the particle system on
- `persistent` (boolean, optional) — Whether the system persists across rooms (default: false)

**Returns:** The new particle system ID.

---

### `create_particle_type`

Creates and configures a new particle type.

**Parameters:**
- `system_id` (number, required) — Particle system ID
- `shape` (string, optional) — Particle shape: `"circle"`, `"square"`, `"line"`, `"star"`, etc. (default: `"circle"`)
- `size_min` (number, optional) — Minimum size (default: 1)
- `size_max` (number, optional) — Maximum size (default: 1)
- `color1` (string, optional) — Start color as hex (default: `"#FFFFFF"`)
- `color2` (string, optional) — End color as hex
- `alpha1` (number, optional) — Start alpha 0.0-1.0
- `alpha2` (number, optional) — End alpha 0.0-1.0
- `life_min` (number, optional) — Minimum lifetime in steps
- `life_max` (number, optional) — Maximum lifetime in steps
- `speed_min` (number, optional) — Minimum speed
- `speed_max` (number, optional) — Maximum speed
- `direction_min` (number, optional) — Minimum direction in degrees
- `direction_max` (number, optional) — Maximum direction in degrees
- `gravity_amount` (number, optional) — Gravity strength
- `gravity_direction` (number, optional) — Gravity direction in degrees

**Returns:** The new particle type ID.

---

### `emit_particles`

Emits particles from a particle system at a position.

**Parameters:**
- `system_id` (number, required) — Particle system ID
- `type_id` (number, required) — Particle type ID
- `x` (number, required) — Emit X position
- `y` (number, required) — Emit Y position
- `count` (number, required) — Number of particles to emit

**Returns:** Confirmation with the number of particles emitted.

---

### `get_particle_count`

Returns the total number of active particles across all systems or for a specific system.

**Parameters:**
- `system_id` (number, optional) — Specific particle system ID (omit for global count)

**Returns:** Total active particle count.

---

### `clear_particles`

Destroys all particles in a system (or all systems).

**Parameters:**
- `system_id` (number, optional) — Specific system to clear (omit to clear all)

**Returns:** Confirmation of how many particles were cleared.

---

## 14. Physics

Tools for inspecting and manipulating the Box2D physics world in GameMaker.

### `get_physics_info`

Returns physics world properties for the current room.

**Parameters:** None

**Returns:** Physics enabled flag, gravity vector (x, y), pixels-to-meters scale, iteration counts (velocity, position), and whether the room uses physics.

---

### `apply_force`

Applies a continuous force to a physics-enabled instance.

**Parameters:**
- `instance_id` (number, required) — Instance ID
- `force_x` (number, required) — Force X component
- `force_y` (number, required) — Force Y component
- `position_x` (number, optional) — Application point X (defaults to instance center)
- `position_y` (number, optional) — Application point Y (defaults to instance center)

**Returns:** Confirmation that the force was applied.

---

### `apply_impulse`

Applies an instantaneous impulse to a physics-enabled instance.

**Parameters:**
- `instance_id` (number, required) — Instance ID
- `impulse_x` (number, required) — Impulse X component
- `impulse_y` (number, required) — Impulse Y component

**Returns:** Confirmation that the impulse was applied.

---

### `set_physics_properties`

Modifies physics properties on an instance (density, friction, restitution).

**Parameters:**
- `instance_id` (number, required) — Instance ID
- `density` (number, optional) — New density value
- `friction` (number, optional) — New friction value 0.0-1.0
- `restitution` (number, optional) — New restitution (bounciness) 0.0-1.0
- `linear_damping` (number, optional) — Linear velocity damping
- `angular_damping` (number, optional) — Angular velocity damping

**Returns:** Confirmation with the updated physics properties.

---

### `get_fixtures`

Returns all physics fixtures attached to an instance.

**Parameters:**
- `instance_id` (number, required) — Instance ID

**Returns:** Array of fixtures with shape type, density, friction, restitution, sensor flag, and shape-specific dimensions.

---

### `raycast`

Performs a physics raycast and returns all intersected fixtures.

**Parameters:**
- `x1` (number, required) — Ray start X
- `y1` (number, required) — Ray start Y
- `x2` (number, required) — Ray end X
- `y2` (number, required) — Ray end Y
- `all_hits` (boolean, optional) — Return all hits or just the nearest (default: false)

**Returns:** Array of hits with instance ID, fixture, hit point (x, y), normal vector, and fraction along the ray.

---

## 15. Data Structures

Tools for inspecting GameMaker data structures (ds_list, ds_map, ds_grid, ds_stack, arrays, and structs).

### `inspect_ds_list`

Returns the contents of a ds_list.

**Parameters:**
- `list_id` (number, required) — The ds_list ID
- `limit` (number, optional) — Maximum entries to return (default: 100)

**Returns:** Array of values in the list, total size, and whether the result was truncated.

---

### `inspect_ds_map`

Returns the contents of a ds_map.

**Parameters:**
- `map_id` (number, required) — The ds_map ID
- `limit` (number, optional) — Maximum entries to return (default: 100)

**Returns:** Object of key-value pairs, total size, and whether the result was truncated.

---

### `inspect_ds_grid`

Returns the contents of a ds_grid.

**Parameters:**
- `grid_id` (number, required) — The ds_grid ID
- `region` (object, optional) — Sub-region: `{ x, y, width, height }` (defaults to full grid)

**Returns:** 2D array of cell values, grid width, and grid height.

---

### `inspect_ds_stack`

Returns the contents of a ds_stack (top to bottom).

**Parameters:**
- `stack_id` (number, required) — The ds_stack ID
- `limit` (number, optional) — Maximum entries to return (default: 100)

**Returns:** Array of values from top to bottom, total size.

---

### `inspect_array`

Returns the contents of an array variable on an instance or global scope.

**Parameters:**
- `instance_id` (number, optional) — Instance ID (omit for global)
- `variable` (string, required) — Variable name containing the array

**Returns:** Array contents, length, and nested array dimensions if applicable.

---

### `inspect_struct`

Returns the contents of a struct variable.

**Parameters:**
- `instance_id` (number, optional) — Instance ID (omit for global)
- `variable` (string, required) — Variable name containing the struct
- `depth` (number, optional) — Maximum nesting depth to expand (default: 2)

**Returns:** Object representation of the struct with keys and values, expanding nested structs up to the specified depth.

---

## 16. Game Control

Tools for controlling game execution: pausing, resuming, stepping, and speed adjustment.

### `pause_game`

Pauses the game loop, freezing all step and draw events.

**Parameters:** None

**Returns:** Confirmation that the game is paused.

---

### `resume_game`

Resumes the game loop after a pause.

**Parameters:** None

**Returns:** Confirmation that the game has resumed.

---

### `set_game_speed`

Changes the target game speed (FPS).

**Parameters:**
- `speed` (number, required) — Target FPS (1-9999)

**Returns:** Confirmation with previous and new game speed.

---

### `restart_game`

Restarts the game from the beginning.

**Parameters:** None

**Returns:** Confirmation that the game restart was initiated.

---

### `get_game_state`

Returns the current game execution state.

**Parameters:** None

**Returns:** Whether the game is paused, current game speed, current room, frame count, and elapsed time in milliseconds.

---

### `step_frame`

Advances the game by exactly one frame (while paused).

**Parameters:**
- `count` (number, optional) — Number of frames to advance (default: 1)

**Returns:** Confirmation with the number of frames advanced and the new frame count.

---

## 17. Alarm

Tools for inspecting and controlling alarms on instances.

### `get_alarms`

Returns all alarm values for a specific instance.

**Parameters:**
- `instance_id` (number, required) — The instance ID

**Returns:** Object with alarm[0] through alarm[11] values (-1 means inactive).

---

### `set_alarm`

Sets an alarm on an instance to a specific countdown value.

**Parameters:**
- `instance_id` (number, required) — The instance ID
- `alarm_index` (number, required) — Alarm index 0-11
- `value` (number, required) — Countdown value in steps (-1 to disable)

**Returns:** Confirmation with previous and new alarm values.

---

### `get_all_alarms`

Returns alarm data for all instances that have active (non -1) alarms.

**Parameters:**
- `alarm_index` (number, optional) — Filter by a specific alarm index

**Returns:** Array of objects with instance ID, object name, and active alarm values.

---

### `cancel_alarm`

Cancels (disables) an alarm on an instance by setting it to -1.

**Parameters:**
- `instance_id` (number, required) — The instance ID
- `alarm_index` (number, required) — Alarm index 0-11

**Returns:** Confirmation that the alarm was cancelled.

---

## 18. Animation

Tools for inspecting and controlling sprite animations on instances.

### `get_sprite_info`

Returns information about a sprite resource.

**Parameters:**
- `sprite_name` (string, required) — Sprite resource name

**Returns:** Sprite name, width, height, number of subimages, origin (x, y), bounding box, texture page info, and whether it has separate collision masks per frame.

---

### `set_sprite_index`

Changes the sprite assigned to an instance.

**Parameters:**
- `instance_id` (number, required) — Instance ID
- `sprite_name` (string, required) — New sprite resource name

**Returns:** Confirmation with previous and new sprite names.

---

### `set_image_index`

Sets the current animation frame on an instance.

**Parameters:**
- `instance_id` (number, required) — Instance ID
- `image_index` (number, required) — Frame index (0-based)

**Returns:** Confirmation with previous and new image index.

---

### `set_image_speed`

Sets the animation playback speed on an instance.

**Parameters:**
- `instance_id` (number, required) — Instance ID
- `image_speed` (number, required) — Playback speed (1.0 = normal, 0 = paused)

**Returns:** Confirmation with previous and new image speed.

---

### `get_animation_state`

Returns the full animation state of an instance.

**Parameters:**
- `instance_id` (number, required) — Instance ID

**Returns:** Current sprite name, image_index, image_speed, image_number (total frames), image_xscale, image_yscale, image_angle, image_alpha, and image_blend.

---

### `set_image_properties`

Sets multiple image/animation properties at once.

**Parameters:**
- `instance_id` (number, required) — Instance ID
- `image_xscale` (number, optional) — Horizontal scale
- `image_yscale` (number, optional) — Vertical scale
- `image_angle` (number, optional) — Rotation in degrees
- `image_alpha` (number, optional) — Transparency 0.0-1.0
- `image_blend` (string, optional) — Blend color as hex string

**Returns:** Confirmation with all updated property values.

---

## 19. Collision

Tools for performing collision checks at runtime.

### `check_collision_point`

Checks for instances at a specific point.

**Parameters:**
- `x` (number, required) — X position
- `y` (number, required) — Y position
- `object_name` (string, optional) — Object type to check (omit for all)
- `precise` (boolean, optional) — Use precise collision checking (default: false)

**Returns:** Array of instance IDs found at the point.

---

### `check_collision_rectangle`

Checks for instances within a rectangular region.

**Parameters:**
- `x1` (number, required) — Left X
- `y1` (number, required) — Top Y
- `x2` (number, required) — Right X
- `y2` (number, required) — Bottom Y
- `object_name` (string, optional) — Object type to check
- `precise` (boolean, optional) — Use precise collision checking (default: false)

**Returns:** Array of instance IDs found within the rectangle.

---

### `check_collision_line`

Checks for instances along a line segment.

**Parameters:**
- `x1` (number, required) — Line start X
- `y1` (number, required) — Line start Y
- `x2` (number, required) — Line end X
- `y2` (number, required) — Line end Y
- `object_name` (string, optional) — Object type to check
- `precise` (boolean, optional) — Use precise collision checking (default: false)

**Returns:** Array of instance IDs intersecting the line, ordered by distance from start.

---

### `get_collision_mask`

Returns the collision mask properties of an instance's current sprite.

**Parameters:**
- `instance_id` (number, required) — Instance ID

**Returns:** Mask mode (auto/manual), bounding box (left, top, right, bottom), mask type (rectangle, ellipse, diamond, precise), and tolerance.

---

### `find_collisions`

Finds all instances currently colliding with a given instance.

**Parameters:**
- `instance_id` (number, required) — Instance ID to check collisions for
- `object_name` (string, optional) — Filter by object type

**Returns:** Array of colliding instance IDs with their object names and positions.

---

## 20. Profiling

Tools for performance statistics and frame profiling.

### `get_performance_stats`

Returns a snapshot of current performance statistics.

**Parameters:** None

**Returns:** FPS (real and target), frame time (ms), step time, draw time, GC time, instance count, draw call count, vertex count, and texture swap count.

---

### `start_profiling`

Begins a profiling session that records per-frame performance data.

**Parameters:**
- `duration_seconds` (number, optional) — How long to profile (default: 5)
- `include_events` (boolean, optional) — Track per-event timing (default: false)

**Returns:** Profiling session ID and confirmation that profiling has started.

---

### `stop_profiling`

Stops an active profiling session early.

**Parameters:**
- `session_id` (string, optional) — Session ID (defaults to most recent)

**Returns:** Confirmation that profiling was stopped, with the number of frames recorded.

---

### `get_profiling_report`

Retrieves the results of a completed profiling session.

**Parameters:**
- `session_id` (string, optional) — Session ID (defaults to most recent)

**Returns:** Summary with average/min/max FPS, average frame time, per-event breakdown (if enabled), hotspot identification, and per-frame time series data.

---

