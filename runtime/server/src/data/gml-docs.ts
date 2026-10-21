// GML Documentation Database - Static reference data for GameMaker Language
// No runtime connection required

export interface GmlFunctionParam {
  name: string;
  type: string;
  optional?: boolean;
  description: string;
}

export interface GmlFunction {
  name: string;
  signature: string;
  description: string;
  params: GmlFunctionParam[];
  returns: string;
  category: string;
  deprecated?: boolean;
  deprecatedNote?: string;
  example?: string;
  related?: string[];
}

// ─── Reserved Words & Built-in Names ───
// These cannot be used as variable names in GML
export const GML_RESERVED_WORDS: string[] = [
  // Language keywords
  "if", "else", "while", "do", "for", "repeat", "until", "switch", "case", "default",
  "break", "continue", "return", "exit", "with", "var", "globalvar", "enum", "function",
  "constructor", "new", "delete", "throw", "try", "catch", "finally", "static",
  // Built-in constants
  "true", "false", "undefined", "infinity", "NaN", "pointer_null", "pointer_invalid",
  "self", "other", "all", "noone", "global",
  // Built-in math functions (commonly mistaken as safe variable names)
  "exp", "log", "log2", "log10", "sin", "cos", "tan", "arcsin", "arccos", "arctan",
  "arctan2", "abs", "sign", "round", "floor", "ceil", "frac", "sqrt", "power",
  "min", "max", "mean", "median", "lerp", "clamp",
  // Type names / conversion functions
  "string", "real", "bool", "int64", "array", "method", "struct", "ref",
  // Other built-in identifiers
  "argument", "argument_count", "argument0", "argument1", "argument2", "argument3",
  "argument4", "argument5", "argument6", "argument7", "argument8", "argument9",
  "argument10", "argument11", "argument12", "argument13", "argument14", "argument15",
];

// ─── Deprecated Functions ───
export const GML_DEPRECATED_FUNCTIONS: { name: string; replacement: string; note: string }[] = [
  { name: "audio_channel_num", replacement: "audio_bus_create (or removed)", note: "Removed in modern GMS2. Audio channels are managed automatically." },
  { name: "execute_string", replacement: "No direct replacement", note: "Removed for security. Use scripts or method variables instead." },
  { name: "execute_file", replacement: "No direct replacement", note: "Removed for security." },
  { name: "background_create_colour", replacement: "Sprites/Surfaces", note: "Background functions removed in GMS2. Use sprites or surfaces." },
  { name: "background_create_from_surface", replacement: "sprite_create_from_surface", note: "Background system removed in GMS2." },
  { name: "background_create_gradient", replacement: "Surfaces + draw functions", note: "Background system removed in GMS2." },
  { name: "background_delete", replacement: "sprite_delete", note: "Background system removed in GMS2." },
  { name: "background_duplicate", replacement: "sprite_duplicate", note: "Background system removed in GMS2." },
  { name: "background_exists", replacement: "sprite_exists", note: "Background system removed in GMS2." },
  { name: "background_get_height", replacement: "sprite_get_height", note: "Background system removed in GMS2." },
  { name: "background_get_width", replacement: "sprite_get_width", note: "Background system removed in GMS2." },
  { name: "object_set_mask", replacement: "Use object editor or mask_index", note: "Deprecated. Set mask_index directly." },
  { name: "instance_change", replacement: "instance_destroy + instance_create_layer", note: "Use destroy then create for clearer control." },
  { name: "room_set_background", replacement: "layer_background_* functions", note: "Old room background system replaced by layers." },
  { name: "room_set_view", replacement: "camera_* functions", note: "Old view system replaced by camera functions." },
  { name: "sound_play", replacement: "audio_play_sound", note: "Old sound system replaced by audio_* functions." },
  { name: "sound_stop", replacement: "audio_stop_sound", note: "Old sound system replaced by audio_* functions." },
  { name: "sound_loop", replacement: "audio_play_sound with loop=true", note: "Old sound system replaced by audio_* functions." },
  { name: "sound_volume", replacement: "audio_sound_gain", note: "Old sound system replaced by audio_* functions." },
  { name: "sound_isplaying", replacement: "audio_is_playing", note: "Old sound system replaced by audio_* functions." },
  { name: "draw_background", replacement: "draw_sprite or layer_background_*", note: "Background system removed in GMS2." },
  { name: "draw_background_ext", replacement: "draw_sprite_ext", note: "Background system removed in GMS2." },
];

// ─── GML Function Categories ───
export const GML_CATEGORIES = [
  "Variable Functions", "Array Functions", "Asset Management",
  "Movement And Collisions", "Drawing", "Cameras And Display",
  "Game Input", "Data Structures", "Strings",
  "Maths And Numbers", "Physics", "Networking",
  "Buffers", "File Handling", "Audio",
  "Particles", "Surfaces", "OS And Compiler",
  "Debugging", "Garbage Collection", "Time Sources",
  "Instances", "Layers", "Rooms", "Sprites",
  "JSON", "Structs", "HTTP And Async",
  "Shaders", "Sequences", "Effects And Filters",
] as const;

// ─── Helper to create function entries concisely ───
function fn(
  name: string, signature: string, description: string,
  params: GmlFunctionParam[], returns: string, category: string,
  opts?: { deprecated?: boolean; deprecatedNote?: string; example?: string; related?: string[] },
): GmlFunction {
  return { name, signature, description, params, returns, category, ...opts };
}
function p(name: string, type: string, description: string, optional?: boolean): GmlFunctionParam {
  return { name, type, description, optional };
}

// ─── Main Function Database ───
export const GML_FUNCTIONS: GmlFunction[] = [

  // ══════════════════════════════════════
  // Instances
  // ══════════════════════════════════════
  fn("instance_create_layer", "instance_create_layer(x, y, layer_id_or_name, object)", "Creates a new instance on the specified layer.",
    [p("x","real","X position"), p("y","real","Y position"), p("layer_id_or_name","string|real","Layer name or ID"), p("object","object","Object to create")],
    "Instance ID", "Instances", { example: 'var inst = instance_create_layer(x, y, "Instances", obj_bullet);', related: ["instance_create_depth", "instance_destroy"] }),
  fn("instance_create_depth", "instance_create_depth(x, y, depth, object)", "Creates a new instance at the specified depth.",
    [p("x","real","X position"), p("y","real","Y position"), p("depth","real","Depth value"), p("object","object","Object to create")],
    "Instance ID", "Instances", { example: "var inst = instance_create_depth(x, y, -100, obj_effect);", related: ["instance_create_layer", "instance_destroy"] }),
  fn("instance_destroy", "instance_destroy(id, execute_event)", "Destroys an instance.",
    [p("id","instance","Instance to destroy (default: self).",true), p("execute_event","bool","Whether to run Destroy event.",true)],
    "void", "Instances", { example: "instance_destroy(); // destroys self", related: ["instance_create_layer", "instance_exists"] }),
  fn("instance_exists", "instance_exists(obj_or_id)", "Checks if an instance or object exists.",
    [p("obj_or_id","real","Instance ID or object index")],
    "bool", "Instances", { example: "if (instance_exists(obj_enemy)) { /* enemies remain */ }", related: ["instance_number", "instance_find"] }),
  fn("instance_find", "instance_find(object, n)", "Returns the ID of the nth instance of the given object.",
    [p("object","object","Object index"), p("n","real","Instance index (0-based)")],
    "Instance ID or noone", "Instances"),
  fn("instance_number", "instance_number(object)", "Returns the number of instances of the given object.",
    [p("object","object","Object index")],
    "real", "Instances"),
  fn("instance_nearest", "instance_nearest(x, y, object)", "Returns the nearest instance of the given object.",
    [p("x","real","X position"), p("y","real","Y position"), p("object","object","Object index")],
    "Instance ID", "Instances"),
  fn("instance_furthest", "instance_furthest(x, y, object)", "Returns the furthest instance of the given object.",
    [p("x","real","X position"), p("y","real","Y position"), p("object","object","Object index")],
    "Instance ID", "Instances"),
  fn("instance_place", "instance_place(x, y, object)", "Checks for collision with an instance at the given position.",
    [p("x","real","X position"), p("y","real","Y position"), p("object","object","Object index")],
    "Instance ID or noone", "Instances"),
  fn("instance_position", "instance_position(x, y, object)", "Returns instance at exact position.",
    [p("x","real","X position"), p("y","real","Y position"), p("object","object","Object index")],
    "Instance ID or noone", "Instances"),

  // ══════════════════════════════════════
  // Physics
  // ══════════════════════════════════════
  fn("physics_apply_force", "physics_apply_force(xpos, ypos, xforce, yforce)", "Applies a force to the instance at a world position.",
    [p("xpos","real","World X position to apply force"), p("ypos","real","World Y position to apply force"), p("xforce","real","X component of force"), p("yforce","real","Y component of force")],
    "void", "Physics"),
  fn("physics_apply_impulse", "physics_apply_impulse(xpos, ypos, ximpulse, yimpulse)", "Applies an impulse to the instance at a world position.",
    [p("xpos","real","World X position"), p("ypos","real","World Y position"), p("ximpulse","real","X impulse"), p("yimpulse","real","Y impulse")],
    "void", "Physics"),
  fn("physics_apply_angular_impulse", "physics_apply_angular_impulse(impulse)", "Applies an angular impulse to the instance.",
    [p("impulse","real","Angular impulse value")],
    "void", "Physics"),
  fn("physics_apply_torque", "physics_apply_torque(torque)", "Applies torque to the instance.",
    [p("torque","real","Torque value")],
    "void", "Physics"),
  fn("physics_apply_local_force", "physics_apply_local_force(xlocal, ylocal, xforce_local, yforce_local)", "Applies a force relative to the instance's local coordinates.",
    [p("xlocal","real","Local X position"), p("ylocal","real","Local Y position"), p("xforce_local","real","Local X force"), p("yforce_local","real","Local Y force")],
    "void", "Physics"),
  fn("physics_apply_local_impulse", "physics_apply_local_impulse(xlocal, ylocal, ximpulse, yimpulse)", "Applies an impulse relative to the instance's local coordinates.",
    [p("xlocal","real","Local X position"), p("ylocal","real","Local Y position"), p("ximpulse","real","Local X impulse"), p("yimpulse","real","Local Y impulse")],
    "void", "Physics"),
  fn("physics_mass_properties", "physics_mass_properties(mass, local_center_x, local_center_y, inertia)", "Sets the mass properties.",
    [p("mass","real","Mass"), p("local_center_x","real","Local center X"), p("local_center_y","real","Local center Y"), p("inertia","real","Inertia")],
    "void", "Physics"),
  fn("physics_joint_distance_create", "physics_joint_distance_create(inst1, inst2, anchor1_x, anchor1_y, anchor2_x, anchor2_y, collide)", "Creates a distance joint.",
    [p("inst1","instance","First instance"), p("inst2","instance","Second instance"), p("anchor1_x","real","Anchor 1 X"), p("anchor1_y","real","Anchor 1 Y"), p("anchor2_x","real","Anchor 2 X"), p("anchor2_y","real","Anchor 2 Y"), p("collide","bool","Allow collision between joined instances")],
    "Physics joint ID", "Physics"),
  fn("physics_joint_revolute_create", "physics_joint_revolute_create(inst1, inst2, anchor_x, anchor_y, lower_angle, upper_angle, enable_limit, max_torque, enable_motor, motor_speed, collide)", "Creates a revolute (hinge) joint.",
    [p("inst1","instance","First instance"), p("inst2","instance","Second instance"), p("anchor_x","real","Anchor X"), p("anchor_y","real","Anchor Y"), p("lower_angle","real","Lower angle limit"), p("upper_angle","real","Upper angle limit"), p("enable_limit","bool","Enable angle limits"), p("max_torque","real","Max motor torque"), p("enable_motor","bool","Enable motor"), p("motor_speed","real","Motor speed"), p("collide","bool","Allow collision")],
    "Physics joint ID", "Physics"),
  fn("physics_joint_delete", "physics_joint_delete(joint_id)", "Deletes a physics joint.",
    [p("joint_id","real","Joint ID to delete")],
    "void", "Physics"),
  fn("physics_world_create", "physics_world_create(pixel_to_metre_scale)", "Creates the physics world for the current room.",
    [p("pixel_to_metre_scale","real","Pixels per metre scale")],
    "void", "Physics"),
  fn("physics_world_gravity", "physics_world_gravity(gx, gy)", "Sets gravity for the physics world.",
    [p("gx","real","X gravity"), p("gy","real","Y gravity")],
    "void", "Physics"),
  fn("physics_fixture_create", "physics_fixture_create()", "Creates a new physics fixture.",
    [], "Fixture ID", "Physics"),
  fn("physics_fixture_set_density", "physics_fixture_set_density(fixture, density)", "Sets fixture density.",
    [p("fixture","real","Fixture ID"), p("density","real","Density value")],
    "void", "Physics"),
  fn("physics_fixture_set_restitution", "physics_fixture_set_restitution(fixture, restitution)", "Sets fixture restitution (bounciness).",
    [p("fixture","real","Fixture ID"), p("restitution","real","Restitution value (0-1)")],
    "void", "Physics"),
  fn("physics_fixture_set_friction", "physics_fixture_set_friction(fixture, friction)", "Sets fixture friction.",
    [p("fixture","real","Fixture ID"), p("friction","real","Friction value")],
    "void", "Physics"),
  fn("physics_fixture_bind", "physics_fixture_bind(fixture, instance)", "Binds a fixture to an instance.",
    [p("fixture","real","Fixture ID"), p("instance","instance","Instance to bind to")],
    "Bound fixture ID", "Physics"),
  fn("physics_fixture_set_box_shape", "physics_fixture_set_box_shape(fixture, half_width, half_height)", "Sets the fixture shape to a box.",
    [p("fixture","real","Fixture ID"), p("half_width","real","Half width"), p("half_height","real","Half height")],
    "void", "Physics"),
  fn("physics_fixture_set_circle_shape", "physics_fixture_set_circle_shape(fixture, radius)", "Sets the fixture shape to a circle.",
    [p("fixture","real","Fixture ID"), p("radius","real","Circle radius")],
    "void", "Physics"),
  fn("physics_fixture_delete", "physics_fixture_delete(fixture)", "Deletes a physics fixture.",
    [p("fixture","real","Fixture ID")],
    "void", "Physics"),

  // ══════════════════════════════════════
  // Audio
  // ══════════════════════════════════════
  fn("audio_play_sound", "audio_play_sound(sound, priority, loop)", "Plays a sound.",
    [p("sound","sound","Sound asset"), p("priority","real","Priority (higher = more important)"), p("loop","bool","Whether to loop")],
    "Sound instance ID", "Audio"),
  fn("audio_play_sound_at", "audio_play_sound_at(sound, x, y, z, falloff_ref, falloff_max, falloff_factor, loop, priority)", "Plays a sound at a 3D position.",
    [p("sound","sound","Sound asset"), p("x","real","X position"), p("y","real","Y position"), p("z","real","Z position"), p("falloff_ref","real","Reference distance"), p("falloff_max","real","Max distance"), p("falloff_factor","real","Falloff factor"), p("loop","bool","Loop"), p("priority","real","Priority")],
    "Sound instance ID", "Audio"),
  fn("audio_stop_sound", "audio_stop_sound(sound)", "Stops a playing sound.",
    [p("sound","sound|real","Sound asset or instance ID")],
    "void", "Audio"),
  fn("audio_stop_all", "audio_stop_all()", "Stops all currently playing sounds.", [], "void", "Audio"),
  fn("audio_pause_sound", "audio_pause_sound(sound)", "Pauses a playing sound.",
    [p("sound","sound|real","Sound asset or instance ID")],
    "void", "Audio"),
  fn("audio_resume_sound", "audio_resume_sound(sound)", "Resumes a paused sound.",
    [p("sound","sound|real","Sound asset or instance ID")],
    "void", "Audio"),
  fn("audio_sound_gain", "audio_sound_gain(sound, volume, time)", "Sets the gain (volume) of a sound over time.",
    [p("sound","sound|real","Sound asset or instance ID"), p("volume","real","Volume (0 to 1)"), p("time","real","Time in ms to transition")],
    "void", "Audio"),
  fn("audio_sound_pitch", "audio_sound_pitch(sound, pitch)", "Sets the pitch of a sound.",
    [p("sound","sound|real","Sound asset or instance ID"), p("pitch","real","Pitch multiplier (1 = normal)")],
    "void", "Audio"),
  fn("audio_is_playing", "audio_is_playing(sound)", "Checks if a sound is playing.",
    [p("sound","sound|real","Sound asset or instance ID")],
    "bool", "Audio"),
  fn("audio_sound_get_gain", "audio_sound_get_gain(sound)", "Gets the gain of a sound.",
    [p("sound","sound|real","Sound asset or instance ID")],
    "real", "Audio"),
  fn("audio_sound_get_pitch", "audio_sound_get_pitch(sound)", "Gets the pitch of a sound.",
    [p("sound","sound|real","Sound asset or instance ID")],
    "real", "Audio"),
  fn("audio_sound_length", "audio_sound_length(sound)", "Gets the length of a sound in seconds.",
    [p("sound","sound","Sound asset")],
    "real", "Audio"),
  fn("audio_listener_position", "audio_listener_position(x, y, z)", "Sets the audio listener position.",
    [p("x","real","X"), p("y","real","Y"), p("z","real","Z")],
    "void", "Audio"),
  fn("audio_emitter_create", "audio_emitter_create()", "Creates an audio emitter.", [], "Emitter ID", "Audio"),
  fn("audio_emitter_free", "audio_emitter_free(emitter)", "Frees an audio emitter.",
    [p("emitter","real","Emitter ID")],
    "void", "Audio"),
  fn("audio_emitter_position", "audio_emitter_position(emitter, x, y, z)", "Sets emitter position.",
    [p("emitter","real","Emitter ID"), p("x","real","X"), p("y","real","Y"), p("z","real","Z")],
    "void", "Audio"),
  fn("audio_group_load", "audio_group_load(group)", "Loads an audio group into memory.",
    [p("group","real","Audio group ID")],
    "void", "Audio"),
  fn("audio_group_unload", "audio_group_unload(group)", "Unloads an audio group from memory.",
    [p("group","real","Audio group ID")],
    "void", "Audio"),

  // ══════════════════════════════════════
  // Movement And Collisions
  // ══════════════════════════════════════
  fn("collision_point", "collision_point(x, y, object, precise, notme)", "Checks for collision at a point.",
    [p("x","real","X position"), p("y","real","Y position"), p("object","object","Object to check"), p("precise","bool","Precise collision check"), p("notme","bool","Exclude calling instance")],
    "Instance ID or noone", "Movement And Collisions"),
  fn("collision_rectangle", "collision_rectangle(x1, y1, x2, y2, object, precise, notme)", "Checks for collision within a rectangle.",
    [p("x1","real","Left"), p("y1","real","Top"), p("x2","real","Right"), p("y2","real","Bottom"), p("object","object","Object to check"), p("precise","bool","Precise check"), p("notme","bool","Exclude self")],
    "Instance ID or noone", "Movement And Collisions"),
  fn("collision_circle", "collision_circle(x, y, radius, object, precise, notme)", "Checks for collision within a circle.",
    [p("x","real","Center X"), p("y","real","Center Y"), p("radius","real","Radius"), p("object","object","Object"), p("precise","bool","Precise"), p("notme","bool","Exclude self")],
    "Instance ID or noone", "Movement And Collisions"),
  fn("collision_line", "collision_line(x1, y1, x2, y2, object, precise, notme)", "Checks for collision along a line.",
    [p("x1","real","Start X"), p("y1","real","Start Y"), p("x2","real","End X"), p("y2","real","End Y"), p("object","object","Object"), p("precise","bool","Precise"), p("notme","bool","Exclude self")],
    "Instance ID or noone", "Movement And Collisions"),
  fn("collision_ellipse", "collision_ellipse(x1, y1, x2, y2, object, precise, notme)", "Checks for collision within an ellipse.",
    [p("x1","real","Left"), p("y1","real","Top"), p("x2","real","Right"), p("y2","real","Bottom"), p("object","object","Object"), p("precise","bool","Precise"), p("notme","bool","Exclude self")],
    "Instance ID or noone", "Movement And Collisions"),
  fn("place_meeting", "place_meeting(x, y, object)", "Checks if placing the instance at (x,y) would cause a collision.",
    [p("x","real","X position"), p("y","real","Y position"), p("object","object","Object to check against")],
    "bool", "Movement And Collisions"),
  fn("place_free", "place_free(x, y)", "Checks if the position is free of solid instances.",
    [p("x","real","X position"), p("y","real","Y position")],
    "bool", "Movement And Collisions"),
  fn("place_empty", "place_empty(x, y)", "Checks if the position is free of all instances.",
    [p("x","real","X position"), p("y","real","Y position")],
    "bool", "Movement And Collisions"),
  fn("move_towards_point", "move_towards_point(x, y, speed)", "Moves towards a point at the given speed.",
    [p("x","real","Target X"), p("y","real","Target Y"), p("speed","real","Speed")],
    "void", "Movement And Collisions"),
  fn("move_snap", "move_snap(hsnap, vsnap)", "Snaps position to a grid.",
    [p("hsnap","real","Horizontal snap"), p("vsnap","real","Vertical snap")],
    "void", "Movement And Collisions"),
  fn("move_wrap", "move_wrap(hor, vert, margin)", "Wraps the instance around the room edges.",
    [p("hor","bool","Wrap horizontally"), p("vert","bool","Wrap vertically"), p("margin","real","Margin outside room")],
    "void", "Movement And Collisions"),
  fn("move_bounce_solid", "move_bounce_solid(advanced)", "Bounces off solid instances.",
    [p("advanced","bool","Use advanced bouncing")],
    "void", "Movement And Collisions"),
  fn("move_contact_solid", "move_contact_solid(direction, maxdist)", "Moves until contact with a solid.",
    [p("direction","real","Direction in degrees"), p("maxdist","real","Maximum distance")],
    "void", "Movement And Collisions"),
  fn("motion_set", "motion_set(dir, speed)", "Sets direction and speed of motion.",
    [p("dir","real","Direction in degrees"), p("speed","real","Speed")],
    "void", "Movement And Collisions"),
  fn("motion_add", "motion_add(dir, speed)", "Adds motion in a direction.",
    [p("dir","real","Direction in degrees"), p("speed","real","Speed to add")],
    "void", "Movement And Collisions"),
  fn("distance_to_object", "distance_to_object(object)", "Returns distance to nearest instance of object.",
    [p("object","object","Object index")],
    "real", "Movement And Collisions"),
  fn("distance_to_point", "distance_to_point(x, y)", "Returns distance to a point.",
    [p("x","real","X position"), p("y","real","Y position")],
    "real", "Movement And Collisions"),
  fn("point_distance", "point_distance(x1, y1, x2, y2)", "Returns distance between two points.",
    [p("x1","real","X1"), p("y1","real","Y1"), p("x2","real","X2"), p("y2","real","Y2")],
    "real", "Movement And Collisions"),
  fn("point_direction", "point_direction(x1, y1, x2, y2)", "Returns direction from one point to another.",
    [p("x1","real","X1"), p("y1","real","Y1"), p("x2","real","X2"), p("y2","real","Y2")],
    "real (degrees)", "Movement And Collisions"),

  // ══════════════════════════════════════
  // Drawing
  // ══════════════════════════════════════
  fn("draw_sprite", "draw_sprite(sprite, subimg, x, y)", "Draws a sprite.",
    [p("sprite","sprite","Sprite asset"), p("subimg","real","Sub-image index (-1 for current)"), p("x","real","X"), p("y","real","Y")],
    "void", "Drawing"),
  fn("draw_sprite_ext", "draw_sprite_ext(sprite, subimg, x, y, xscale, yscale, rot, colour, alpha)", "Draws a sprite with transformations.",
    [p("sprite","sprite","Sprite asset"), p("subimg","real","Sub-image"), p("x","real","X"), p("y","real","Y"), p("xscale","real","X scale"), p("yscale","real","Y scale"), p("rot","real","Rotation"), p("colour","real","Blend colour"), p("alpha","real","Alpha (0-1)")],
    "void", "Drawing"),
  fn("draw_self", "draw_self()", "Draws the instance's assigned sprite.", [], "void", "Drawing"),
  fn("draw_text", "draw_text(x, y, string)", "Draws text.",
    [p("x","real","X"), p("y","real","Y"), p("string","string","Text to draw")],
    "void", "Drawing"),
  fn("draw_text_ext", "draw_text_ext(x, y, string, sep, w)", "Draws text with line separation and width.",
    [p("x","real","X"), p("y","real","Y"), p("string","string","Text"), p("sep","real","Line height (-1 for default)"), p("w","real","Max width (-1 for no wrap)")],
    "void", "Drawing"),
  fn("draw_text_transformed", "draw_text_transformed(x, y, string, xscale, yscale, angle)", "Draws text with transformations.",
    [p("x","real","X"), p("y","real","Y"), p("string","string","Text"), p("xscale","real","X scale"), p("yscale","real","Y scale"), p("angle","real","Rotation angle")],
    "void", "Drawing"),
  fn("draw_text_colour", "draw_text_colour(x, y, string, c1, c2, c3, c4, alpha)", "Draws text with gradient colours.",
    [p("x","real","X"), p("y","real","Y"), p("string","string","Text"), p("c1","real","Top-left colour"), p("c2","real","Top-right colour"), p("c3","real","Bottom-right colour"), p("c4","real","Bottom-left colour"), p("alpha","real","Alpha")],
    "void", "Drawing"),
  fn("draw_set_font", "draw_set_font(font)", "Sets the current drawing font.",
    [p("font","font","Font asset (-1 for default)")],
    "void", "Drawing"),
  fn("draw_set_halign", "draw_set_halign(halign)", "Sets horizontal text alignment.",
    [p("halign","constant","fa_left, fa_center, or fa_right")],
    "void", "Drawing"),
  fn("draw_set_valign", "draw_set_valign(valign)", "Sets vertical text alignment.",
    [p("valign","constant","fa_top, fa_middle, or fa_bottom")],
    "void", "Drawing"),
  fn("draw_set_colour", "draw_set_colour(colour)", "Sets the draw colour.",
    [p("colour","real","Colour value")],
    "void", "Drawing"),
  fn("draw_set_alpha", "draw_set_alpha(alpha)", "Sets the draw alpha.",
    [p("alpha","real","Alpha (0-1)")],
    "void", "Drawing"),
  fn("draw_rectangle", "draw_rectangle(x1, y1, x2, y2, outline)", "Draws a rectangle.",
    [p("x1","real","Left"), p("y1","real","Top"), p("x2","real","Right"), p("y2","real","Bottom"), p("outline","bool","Outline only")],
    "void", "Drawing"),
  fn("draw_circle", "draw_circle(x, y, radius, outline)", "Draws a circle.",
    [p("x","real","Center X"), p("y","real","Center Y"), p("radius","real","Radius"), p("outline","bool","Outline only")],
    "void", "Drawing"),
  fn("draw_line", "draw_line(x1, y1, x2, y2)", "Draws a line.",
    [p("x1","real","Start X"), p("y1","real","Start Y"), p("x2","real","End X"), p("y2","real","End Y")],
    "void", "Drawing"),
  fn("draw_line_width", "draw_line_width(x1, y1, x2, y2, width)", "Draws a line with specified width.",
    [p("x1","real","Start X"), p("y1","real","Start Y"), p("x2","real","End X"), p("y2","real","End Y"), p("width","real","Line width")],
    "void", "Drawing"),
  fn("draw_roundrect", "draw_roundrect(x1, y1, x2, y2, outline)", "Draws a rounded rectangle.",
    [p("x1","real","Left"), p("y1","real","Top"), p("x2","real","Right"), p("y2","real","Bottom"), p("outline","bool","Outline only")],
    "void", "Drawing"),
  fn("draw_triangle", "draw_triangle(x1, y1, x2, y2, x3, y3, outline)", "Draws a triangle.",
    [p("x1","real","X1"), p("y1","real","Y1"), p("x2","real","X2"), p("y2","real","Y2"), p("x3","real","X3"), p("y3","real","Y3"), p("outline","bool","Outline only")],
    "void", "Drawing"),
  fn("draw_ellipse", "draw_ellipse(x1, y1, x2, y2, outline)", "Draws an ellipse.",
    [p("x1","real","Left"), p("y1","real","Top"), p("x2","real","Right"), p("y2","real","Bottom"), p("outline","bool","Outline only")],
    "void", "Drawing"),
  fn("draw_arrow", "draw_arrow(x1, y1, x2, y2, size)", "Draws an arrow.",
    [p("x1","real","Start X"), p("y1","real","Start Y"), p("x2","real","End X"), p("y2","real","End Y"), p("size","real","Arrow head size")],
    "void", "Drawing"),
  fn("draw_surface", "draw_surface(surface, x, y)", "Draws a surface.",
    [p("surface","real","Surface ID"), p("x","real","X"), p("y","real","Y")],
    "void", "Drawing"),
  fn("draw_surface_ext", "draw_surface_ext(surface, x, y, xscale, yscale, rot, colour, alpha)", "Draws a surface with transformations.",
    [p("surface","real","Surface ID"), p("x","real","X"), p("y","real","Y"), p("xscale","real","X scale"), p("yscale","real","Y scale"), p("rot","real","Rotation"), p("colour","real","Blend colour"), p("alpha","real","Alpha")],
    "void", "Drawing"),
  fn("make_colour_rgb", "make_colour_rgb(red, green, blue)", "Creates a colour from RGB values.",
    [p("red","real","Red (0-255)"), p("green","real","Green (0-255)"), p("blue","real","Blue (0-255)")],
    "real (colour)", "Drawing"),
  fn("make_colour_hsv", "make_colour_hsv(hue, saturation, value)", "Creates a colour from HSV values.",
    [p("hue","real","Hue (0-255)"), p("saturation","real","Saturation (0-255)"), p("value","real","Value (0-255)")],
    "real (colour)", "Drawing"),
  fn("merge_colour", "merge_colour(col1, col2, amount)", "Blends two colours.",
    [p("col1","real","First colour"), p("col2","real","Second colour"), p("amount","real","Blend amount (0-1)")],
    "real (colour)", "Drawing"),
  fn("gpu_set_blendmode", "gpu_set_blendmode(mode)", "Sets the blend mode.",
    [p("mode","constant","bm_normal, bm_add, bm_subtract, bm_max")],
    "void", "Drawing"),
  fn("gpu_set_blendmode_ext", "gpu_set_blendmode_ext(src, dest)", "Sets extended blend mode.",
    [p("src","constant","Source blend factor"), p("dest","constant","Destination blend factor")],
    "void", "Drawing"),
  fn("draw_sprite_stretched", "draw_sprite_stretched(sprite, subimg, x, y, w, h)", "Draws a sprite stretched to fill a rectangle.",
    [p("sprite","sprite","Sprite asset"), p("subimg","real","Sub-image"), p("x","real","X"), p("y","real","Y"), p("w","real","Width"), p("h","real","Height")], "void", "Drawing"),
  fn("draw_sprite_stretched_ext", "draw_sprite_stretched_ext(sprite, subimg, x, y, w, h, colour, alpha)", "Draws a stretched sprite with colour and alpha.",
    [p("sprite","sprite","Sprite"), p("subimg","real","Sub-image"), p("x","real","X"), p("y","real","Y"), p("w","real","Width"), p("h","real","Height"), p("colour","real","Blend colour"), p("alpha","real","Alpha")], "void", "Drawing"),
  fn("draw_sprite_tiled", "draw_sprite_tiled(sprite, subimg, x, y)", "Draws a sprite tiled across the entire view.",
    [p("sprite","sprite","Sprite asset"), p("subimg","real","Sub-image"), p("x","real","X offset"), p("y","real","Y offset")], "void", "Drawing"),
  fn("draw_sprite_tiled_ext", "draw_sprite_tiled_ext(sprite, subimg, x, y, xscale, yscale, colour, alpha)", "Draws a tiled sprite with transformations.",
    [p("sprite","sprite","Sprite"), p("subimg","real","Sub-image"), p("x","real","X"), p("y","real","Y"), p("xscale","real","X scale"), p("yscale","real","Y scale"), p("colour","real","Colour"), p("alpha","real","Alpha")], "void", "Drawing"),
  fn("draw_sprite_part", "draw_sprite_part(sprite, subimg, left, top, width, height, x, y)", "Draws part of a sprite.",
    [p("sprite","sprite","Sprite"), p("subimg","real","Sub-image"), p("left","real","Source left"), p("top","real","Source top"), p("width","real","Source width"), p("height","real","Source height"), p("x","real","X"), p("y","real","Y")], "void", "Drawing"),
  fn("draw_sprite_part_ext", "draw_sprite_part_ext(sprite, subimg, left, top, width, height, x, y, xscale, yscale, colour, alpha)", "Draws part of a sprite with transformations.",
    [p("sprite","sprite","Sprite"), p("subimg","real","Sub-image"), p("left","real","Left"), p("top","real","Top"), p("width","real","Width"), p("height","real","Height"), p("x","real","X"), p("y","real","Y"), p("xscale","real","X scale"), p("yscale","real","Y scale"), p("colour","real","Colour"), p("alpha","real","Alpha")], "void", "Drawing"),
  fn("draw_sprite_general", "draw_sprite_general(sprite, subimg, left, top, width, height, x, y, xscale, yscale, rot, c1, c2, c3, c4, alpha)", "Draws a sprite with full control over all parameters.",
    [p("sprite","sprite","Sprite"), p("subimg","real","Sub-image"), p("left","real","Left"), p("top","real","Top"), p("width","real","Width"), p("height","real","Height"), p("x","real","X"), p("y","real","Y"), p("xscale","real","X scale"), p("yscale","real","Y scale"), p("rot","real","Rotation"), p("c1","real","Top-left colour"), p("c2","real","Top-right colour"), p("c3","real","Bottom-right colour"), p("c4","real","Bottom-left colour"), p("alpha","real","Alpha")], "void", "Drawing"),
  fn("draw_rectangle_colour", "draw_rectangle_colour(x1, y1, x2, y2, c1, c2, c3, c4, outline)", "Draws a rectangle with per-corner colours.",
    [p("x1","real","Left"), p("y1","real","Top"), p("x2","real","Right"), p("y2","real","Bottom"), p("c1","real","Top-left colour"), p("c2","real","Top-right colour"), p("c3","real","Bottom-right colour"), p("c4","real","Bottom-left colour"), p("outline","bool","Outline")], "void", "Drawing"),
  fn("draw_line_colour", "draw_line_colour(x1, y1, x2, y2, col1, col2)", "Draws a line with gradient colour.",
    [p("x1","real","Start X"), p("y1","real","Start Y"), p("x2","real","End X"), p("y2","real","End Y"), p("col1","real","Start colour"), p("col2","real","End colour")], "void", "Drawing"),
  fn("draw_line_width_colour", "draw_line_width_colour(x1, y1, x2, y2, w, col1, col2)", "Draws a thick line with gradient.",
    [p("x1","real","X1"), p("y1","real","Y1"), p("x2","real","X2"), p("y2","real","Y2"), p("w","real","Width"), p("col1","real","Start colour"), p("col2","real","End colour")], "void", "Drawing"),
  fn("draw_circle_colour", "draw_circle_colour(x, y, radius, col1, col2, outline)", "Draws a circle with inner/outer colours.",
    [p("x","real","X"), p("y","real","Y"), p("radius","real","Radius"), p("col1","real","Inner colour"), p("col2","real","Outer colour"), p("outline","bool","Outline")], "void", "Drawing"),
  fn("draw_text_ext_transformed", "draw_text_ext_transformed(x, y, string, sep, w, xscale, yscale, angle)", "Draws wrapped text with transformations.",
    [p("x","real","X"), p("y","real","Y"), p("string","string","Text"), p("sep","real","Line height"), p("w","real","Max width"), p("xscale","real","X scale"), p("yscale","real","Y scale"), p("angle","real","Angle")], "void", "Drawing"),
  fn("draw_vertex", "draw_vertex(x, y)", "Adds a vertex to the current primitive.",
    [p("x","real","X"), p("y","real","Y")], "void", "Drawing"),
  fn("draw_vertex_colour", "draw_vertex_colour(x, y, colour, alpha)", "Adds a coloured vertex to the current primitive.",
    [p("x","real","X"), p("y","real","Y"), p("colour","real","Colour"), p("alpha","real","Alpha")], "void", "Drawing"),
  fn("draw_vertex_texture", "draw_vertex_texture(x, y, xtex, ytex)", "Adds a textured vertex to the current primitive.",
    [p("x","real","X"), p("y","real","Y"), p("xtex","real","Texture X (0-1)"), p("ytex","real","Texture Y (0-1)")], "void", "Drawing"),
  fn("draw_vertex_texture_colour", "draw_vertex_texture_colour(x, y, xtex, ytex, col, alpha)", "Adds a textured, coloured vertex.",
    [p("x","real","X"), p("y","real","Y"), p("xtex","real","Tex X"), p("ytex","real","Tex Y"), p("col","real","Colour"), p("alpha","real","Alpha")], "void", "Drawing"),
  fn("draw_primitive_begin", "draw_primitive_begin(kind)", "Starts defining a primitive.",
    [p("kind","constant","pr_pointlist, pr_linelist, pr_linestrip, pr_trianglelist, pr_trianglestrip, pr_trianglefan")], "void", "Drawing"),
  fn("draw_primitive_end", "draw_primitive_end()", "Ends and draws the current primitive.", [], "void", "Drawing"),
  fn("draw_primitive_begin_texture", "draw_primitive_begin_texture(kind, texture)", "Starts a textured primitive.",
    [p("kind","constant","Primitive type"), p("texture","real","Texture pointer")], "void", "Drawing"),
  fn("draw_get_colour", "draw_get_colour()", "Returns the current draw colour.", [], "real (colour)", "Drawing"),
  fn("draw_get_alpha", "draw_get_alpha()", "Returns the current draw alpha.", [], "real", "Drawing"),
  fn("draw_getpixel", "draw_getpixel(x, y)", "Returns the colour of a pixel on screen.",
    [p("x","real","X"), p("y","real","Y")], "real (colour)", "Drawing"),
  fn("draw_getpixel_ext", "draw_getpixel_ext(x, y)", "Returns the colour and alpha of a pixel.",
    [p("x","real","X"), p("y","real","Y")], "real", "Drawing"),
  fn("draw_clear", "draw_clear(colour)", "Clears the draw surface to a colour.",
    [p("colour","real","Colour")], "void", "Drawing"),
  fn("draw_clear_alpha", "draw_clear_alpha(colour, alpha)", "Clears the draw surface to a colour with alpha.",
    [p("colour","real","Colour"), p("alpha","real","Alpha")], "void", "Drawing"),
  fn("colour_get_red", "colour_get_red(colour)", "Returns the red component (0-255).",
    [p("colour","real","Colour value")], "real", "Drawing"),
  fn("colour_get_green", "colour_get_green(colour)", "Returns the green component (0-255).",
    [p("colour","real","Colour value")], "real", "Drawing"),
  fn("colour_get_blue", "colour_get_blue(colour)", "Returns the blue component (0-255).",
    [p("colour","real","Colour value")], "real", "Drawing"),
  fn("colour_get_hue", "colour_get_hue(colour)", "Returns the hue component (0-255).",
    [p("colour","real","Colour value")], "real", "Drawing"),
  fn("colour_get_saturation", "colour_get_saturation(colour)", "Returns the saturation (0-255).",
    [p("colour","real","Colour value")], "real", "Drawing"),
  fn("colour_get_value", "colour_get_value(colour)", "Returns the value/brightness (0-255).",
    [p("colour","real","Colour value")], "real", "Drawing"),
  fn("gpu_set_alphatestenable", "gpu_set_alphatestenable(enable)", "Enables or disables alpha testing.",
    [p("enable","bool","Enable alpha test")], "void", "Drawing"),
  fn("gpu_set_alphatestref", "gpu_set_alphatestref(ref)", "Sets the alpha test reference value.",
    [p("ref","real","Reference value (0-255)")], "void", "Drawing"),
  fn("gpu_set_zwriteenable", "gpu_set_zwriteenable(enable)", "Enables or disables depth buffer writing.",
    [p("enable","bool","Enable Z-write")], "void", "Drawing"),
  fn("gpu_set_ztestenable", "gpu_set_ztestenable(enable)", "Enables or disables depth testing.",
    [p("enable","bool","Enable Z-test")], "void", "Drawing"),
  fn("gpu_set_texfilter", "gpu_set_texfilter(enable)", "Enables or disables texture filtering (interpolation).",
    [p("enable","bool","Enable filtering")], "void", "Drawing"),
  fn("gpu_set_texrepeat", "gpu_set_texrepeat(enable)", "Enables or disables texture repeating.",
    [p("enable","bool","Enable repeat")], "void", "Drawing"),
  fn("gpu_set_cullmode", "gpu_set_cullmode(mode)", "Sets the face culling mode.",
    [p("mode","constant","cull_noculling, cull_clockwise, cull_counterclockwise")], "void", "Drawing"),

  // ══════════════════════════════════════
  // Cameras And Display
  // ══════════════════════════════════════
  fn("camera_create", "camera_create()", "Creates a new camera.", [], "Camera ID", "Cameras And Display"),
  fn("camera_create_view", "camera_create_view(room_x, room_y, width, height, angle, object, x_speed, y_speed, x_border, y_border)", "Creates a camera with view settings.",
    [p("room_x","real","Room X"), p("room_y","real","Room Y"), p("width","real","View width"), p("height","real","View height"), p("angle","real","Rotation angle"), p("object","object","Object to follow (-1 for none)"), p("x_speed","real","Horizontal follow speed"), p("y_speed","real","Vertical follow speed"), p("x_border","real","Horizontal border"), p("y_border","real","Vertical border")],
    "Camera ID", "Cameras And Display"),
  fn("camera_destroy", "camera_destroy(camera)", "Destroys a camera.",
    [p("camera","real","Camera ID")],
    "void", "Cameras And Display"),
  fn("camera_set_view_pos", "camera_set_view_pos(camera, x, y)", "Sets camera position.",
    [p("camera","real","Camera ID"), p("x","real","X position"), p("y","real","Y position")],
    "void", "Cameras And Display"),
  fn("camera_set_view_size", "camera_set_view_size(camera, width, height)", "Sets camera view size.",
    [p("camera","real","Camera ID"), p("width","real","Width"), p("height","real","Height")],
    "void", "Cameras And Display"),
  fn("camera_set_view_angle", "camera_set_view_angle(camera, angle)", "Sets camera rotation angle.",
    [p("camera","real","Camera ID"), p("angle","real","Angle in degrees")],
    "void", "Cameras And Display"),
  fn("camera_set_view_target", "camera_set_view_target(camera, object)", "Sets the object the camera follows.",
    [p("camera","real","Camera ID"), p("object","object","Object to follow")],
    "void", "Cameras And Display"),
  fn("camera_get_view_x", "camera_get_view_x(camera)", "Gets camera X position.",
    [p("camera","real","Camera ID")], "real", "Cameras And Display"),
  fn("camera_get_view_y", "camera_get_view_y(camera)", "Gets camera Y position.",
    [p("camera","real","Camera ID")], "real", "Cameras And Display"),
  fn("camera_get_view_width", "camera_get_view_width(camera)", "Gets camera view width.",
    [p("camera","real","Camera ID")], "real", "Cameras And Display"),
  fn("camera_get_view_height", "camera_get_view_height(camera)", "Gets camera view height.",
    [p("camera","real","Camera ID")], "real", "Cameras And Display"),
  fn("view_set_camera", "view_set_camera(view, camera)", "Assigns a camera to a view port.",
    [p("view","real","View port index (0-7)"), p("camera","real","Camera ID")],
    "void", "Cameras And Display"),
  fn("display_get_width", "display_get_width()", "Gets display width.", [], "real", "Cameras And Display"),
  fn("display_get_height", "display_get_height()", "Gets display height.", [], "real", "Cameras And Display"),
  fn("window_set_size", "window_set_size(width, height)", "Sets game window size.",
    [p("width","real","Width"), p("height","real","Height")],
    "void", "Cameras And Display"),
  fn("window_set_position", "window_set_position(x, y)", "Sets game window position.",
    [p("x","real","X"), p("y","real","Y")],
    "void", "Cameras And Display"),
  fn("window_get_width", "window_get_width()", "Gets window width.", [], "real", "Cameras And Display"),
  fn("window_get_height", "window_get_height()", "Gets window height.", [], "real", "Cameras And Display"),
  fn("camera_get_view_angle", "camera_get_view_angle(camera)", "Gets camera rotation angle.",
    [p("camera","real","Camera ID")], "real", "Cameras And Display"),
  fn("camera_set_view_speed", "camera_set_view_speed(camera, x_speed, y_speed)", "Sets camera follow speed.",
    [p("camera","real","Camera ID"), p("x_speed","real","Horizontal speed"), p("y_speed","real","Vertical speed")], "void", "Cameras And Display"),
  fn("camera_set_view_border", "camera_set_view_border(camera, x_border, y_border)", "Sets camera follow borders.",
    [p("camera","real","Camera ID"), p("x_border","real","Horizontal border"), p("y_border","real","Vertical border")], "void", "Cameras And Display"),
  fn("camera_set_update_script", "camera_set_update_script(camera, script)", "Sets a custom camera update script.",
    [p("camera","real","Camera ID"), p("script","function","Update function")], "void", "Cameras And Display"),
  fn("camera_apply", "camera_apply(camera)", "Applies camera matrices to the current render.",
    [p("camera","real","Camera ID")], "void", "Cameras And Display"),
  fn("window_set_fullscreen", "window_set_fullscreen(full)", "Sets fullscreen mode.",
    [p("full","bool","Enable fullscreen")], "void", "Cameras And Display"),
  fn("window_get_fullscreen", "window_get_fullscreen()", "Returns whether window is fullscreen.", [], "bool", "Cameras And Display"),
  fn("window_set_caption", "window_set_caption(caption)", "Sets the window title bar text.",
    [p("caption","string","Window title")], "void", "Cameras And Display"),
  fn("window_get_x", "window_get_x()", "Gets window X position.", [], "real", "Cameras And Display"),
  fn("window_get_y", "window_get_y()", "Gets window Y position.", [], "real", "Cameras And Display"),
  fn("window_center", "window_center()", "Centers the window on screen.", [], "void", "Cameras And Display"),
  fn("display_set_gui_size", "display_set_gui_size(width, height)", "Sets the GUI layer size.",
    [p("width","real","GUI width"), p("height","real","GUI height")], "void", "Cameras And Display"),
  fn("display_get_gui_width", "display_get_gui_width()", "Gets the GUI layer width.", [], "real", "Cameras And Display"),
  fn("display_get_gui_height", "display_get_gui_height()", "Gets the GUI layer height.", [], "real", "Cameras And Display"),
  fn("surface_resize", "surface_resize(surface, width, height)", "Resizes a surface.",
    [p("surface","real","Surface ID"), p("width","real","New width"), p("height","real","New height")], "void", "Surfaces"),

  // ══════════════════════════════════════
  // Game Input
  // ══════════════════════════════════════
  fn("keyboard_check", "keyboard_check(key)", "Checks if a key is held down.",
    [p("key","real","Key constant (e.g. vk_left, ord('A'))")],
    "bool", "Game Input"),
  fn("keyboard_check_pressed", "keyboard_check_pressed(key)", "Checks if a key was just pressed.",
    [p("key","real","Key constant")], "bool", "Game Input"),
  fn("keyboard_check_released", "keyboard_check_released(key)", "Checks if a key was just released.",
    [p("key","real","Key constant")], "bool", "Game Input"),
  fn("mouse_check_button", "mouse_check_button(button)", "Checks if a mouse button is held.",
    [p("button","real","mb_left, mb_right, mb_middle")], "bool", "Game Input"),
  fn("mouse_check_button_pressed", "mouse_check_button_pressed(button)", "Checks if a mouse button was just pressed.",
    [p("button","real","mb_left, mb_right, mb_middle")], "bool", "Game Input"),
  fn("mouse_check_button_released", "mouse_check_button_released(button)", "Checks if a mouse button was just released.",
    [p("button","real","mb_left, mb_right, mb_middle")], "bool", "Game Input"),
  fn("gamepad_is_connected", "gamepad_is_connected(device)", "Checks if a gamepad is connected.",
    [p("device","real","Gamepad slot index (0-11)")], "bool", "Game Input"),
  fn("gamepad_axis_value", "gamepad_axis_value(device, axis)", "Gets gamepad axis value (-1 to 1).",
    [p("device","real","Gamepad slot"), p("axis","real","Axis constant (e.g. gp_axislh)")], "real", "Game Input"),
  fn("gamepad_button_check", "gamepad_button_check(device, button)", "Checks if a gamepad button is held.",
    [p("device","real","Gamepad slot"), p("button","real","Button constant (e.g. gp_face1)")], "bool", "Game Input"),
  fn("gamepad_button_check_pressed", "gamepad_button_check_pressed(device, button)", "Checks if a gamepad button was just pressed.",
    [p("device","real","Gamepad slot"), p("button","real","Button constant")], "bool", "Game Input"),
  fn("gamepad_button_check_released", "gamepad_button_check_released(device, button)", "Checks if a gamepad button was just released.",
    [p("device","real","Gamepad slot"), p("button","real","Button constant")], "bool", "Game Input"),
  fn("gamepad_get_device_count", "gamepad_get_device_count()", "Returns the number of gamepad slots.", [], "real", "Game Input"),
  fn("gamepad_get_description", "gamepad_get_description(device)", "Returns the description string for a gamepad.",
    [p("device","real","Gamepad slot")], "string", "Game Input"),
  fn("gamepad_set_axis_deadzone", "gamepad_set_axis_deadzone(device, deadzone)", "Sets the deadzone for gamepad axes.",
    [p("device","real","Gamepad slot"), p("deadzone","real","Deadzone value (0-1)")], "void", "Game Input"),
  fn("gamepad_set_vibration", "gamepad_set_vibration(device, left_motor, right_motor)", "Sets gamepad vibration.",
    [p("device","real","Gamepad slot"), p("left_motor","real","Left motor (0-1)"), p("right_motor","real","Right motor (0-1)")], "void", "Game Input"),
  fn("keyboard_check_direct", "keyboard_check_direct(key)", "Checks physical key state directly (bypasses focus).",
    [p("key","real","Key constant")], "bool", "Game Input"),
  fn("keyboard_clear", "keyboard_clear(key)", "Clears the state of a key.",
    [p("key","real","Key constant")], "void", "Game Input"),
  fn("mouse_clear", "mouse_clear(button)", "Clears the state of a mouse button.",
    [p("button","real","Mouse button constant")], "void", "Game Input"),
  fn("keyboard_set_map", "keyboard_set_map(key1, key2)", "Maps one key to another.",
    [p("key1","real","Source key"), p("key2","real","Destination key")], "void", "Game Input"),
  fn("keyboard_unset_map", "keyboard_unset_map()", "Clears all keyboard mappings.", [], "void", "Game Input"),
  fn("mouse_wheel_up", "mouse_wheel_up()", "Checks if mouse wheel scrolled up.", [], "bool", "Game Input"),
  fn("mouse_wheel_down", "mouse_wheel_down()", "Checks if mouse wheel scrolled down.", [], "bool", "Game Input"),
  fn("device_mouse_x_to_gui", "device_mouse_x_to_gui(device)", "Returns device mouse X in GUI coordinates.",
    [p("device","real","Device index (0 for mouse)")], "real", "Game Input"),
  fn("device_mouse_y_to_gui", "device_mouse_y_to_gui(device)", "Returns device mouse Y in GUI coordinates.",
    [p("device","real","Device index (0 for mouse)")], "real", "Game Input"),

  // ══════════════════════════════════════
  // Data Structures
  // ══════════════════════════════════════
  fn("ds_list_create", "ds_list_create()", "Creates a new list.", [], "DS list ID", "Data Structures"),
  fn("ds_list_destroy", "ds_list_destroy(list)", "Destroys a list.",
    [p("list","real","List ID")], "void", "Data Structures"),
  fn("ds_list_add", "ds_list_add(list, ...values)", "Adds values to a list.",
    [p("list","real","List ID"), p("...values","any","Values to add")], "void", "Data Structures"),
  fn("ds_list_size", "ds_list_size(list)", "Returns list size.",
    [p("list","real","List ID")], "real", "Data Structures"),
  fn("ds_list_find_value", "ds_list_find_value(list, pos)", "Gets value at position.",
    [p("list","real","List ID"), p("pos","real","Position index")], "any", "Data Structures"),
  fn("ds_list_delete", "ds_list_delete(list, pos)", "Deletes value at position.",
    [p("list","real","List ID"), p("pos","real","Position index")], "void", "Data Structures"),
  fn("ds_list_clear", "ds_list_clear(list)", "Clears all values from list.",
    [p("list","real","List ID")], "void", "Data Structures"),
  fn("ds_list_sort", "ds_list_sort(list, ascending)", "Sorts a list.",
    [p("list","real","List ID"), p("ascending","bool","Sort ascending")], "void", "Data Structures"),
  fn("ds_list_shuffle", "ds_list_shuffle(list)", "Shuffles a list randomly.",
    [p("list","real","List ID")], "void", "Data Structures"),
  fn("ds_map_create", "ds_map_create()", "Creates a new map.", [], "DS map ID", "Data Structures"),
  fn("ds_map_destroy", "ds_map_destroy(map)", "Destroys a map.",
    [p("map","real","Map ID")], "void", "Data Structures"),
  fn("ds_map_add", "ds_map_add(map, key, value)", "Adds a key-value pair.",
    [p("map","real","Map ID"), p("key","string","Key"), p("value","any","Value")], "void", "Data Structures"),
  fn("ds_map_find_value", "ds_map_find_value(map, key)", "Gets value for key.",
    [p("map","real","Map ID"), p("key","string","Key")], "any", "Data Structures"),
  fn("ds_map_exists", "ds_map_exists(map, key)", "Checks if key exists in map.",
    [p("map","real","Map ID"), p("key","string","Key")], "bool", "Data Structures"),
  fn("ds_map_delete", "ds_map_delete(map, key)", "Deletes a key from map.",
    [p("map","real","Map ID"), p("key","string","Key")], "void", "Data Structures"),
  fn("ds_map_size", "ds_map_size(map)", "Returns number of entries in map.",
    [p("map","real","Map ID")], "real", "Data Structures"),
  fn("ds_map_clear", "ds_map_clear(map)", "Clears all entries from map.",
    [p("map","real","Map ID")], "void", "Data Structures"),
  fn("ds_grid_create", "ds_grid_create(width, height)", "Creates a new grid.",
    [p("width","real","Grid width"), p("height","real","Grid height")], "DS grid ID", "Data Structures"),
  fn("ds_grid_destroy", "ds_grid_destroy(grid)", "Destroys a grid.",
    [p("grid","real","Grid ID")], "void", "Data Structures"),
  fn("ds_grid_set", "ds_grid_set(grid, x, y, value)", "Sets a grid cell value.",
    [p("grid","real","Grid ID"), p("x","real","Column"), p("y","real","Row"), p("value","any","Value")], "void", "Data Structures"),
  fn("ds_grid_get", "ds_grid_get(grid, x, y)", "Gets a grid cell value.",
    [p("grid","real","Grid ID"), p("x","real","Column"), p("y","real","Row")], "any", "Data Structures"),
  fn("ds_stack_create", "ds_stack_create()", "Creates a new stack.", [], "DS stack ID", "Data Structures"),
  fn("ds_stack_destroy", "ds_stack_destroy(stack)", "Destroys a stack.",
    [p("stack","real","Stack ID")], "void", "Data Structures"),
  fn("ds_stack_push", "ds_stack_push(stack, ...values)", "Pushes values onto stack.",
    [p("stack","real","Stack ID"), p("...values","any","Values to push")], "void", "Data Structures"),
  fn("ds_stack_pop", "ds_stack_pop(stack)", "Pops value from stack.",
    [p("stack","real","Stack ID")], "any", "Data Structures"),
  fn("ds_stack_top", "ds_stack_top(stack)", "Gets top value without removing.",
    [p("stack","real","Stack ID")], "any", "Data Structures"),
  fn("ds_queue_create", "ds_queue_create()", "Creates a new queue.", [], "DS queue ID", "Data Structures"),
  fn("ds_queue_destroy", "ds_queue_destroy(queue)", "Destroys a queue.",
    [p("queue","real","Queue ID")], "void", "Data Structures"),
  fn("ds_queue_enqueue", "ds_queue_enqueue(queue, ...values)", "Adds values to queue.",
    [p("queue","real","Queue ID"), p("...values","any","Values to enqueue")], "void", "Data Structures"),
  fn("ds_queue_dequeue", "ds_queue_dequeue(queue)", "Removes and returns front value.",
    [p("queue","real","Queue ID")], "any", "Data Structures"),
  fn("ds_priority_create", "ds_priority_create()", "Creates a priority queue.", [], "DS priority ID", "Data Structures"),
  fn("ds_priority_destroy", "ds_priority_destroy(queue)", "Destroys a priority queue.",
    [p("queue","real","Priority queue ID")], "void", "Data Structures"),
  fn("ds_priority_add", "ds_priority_add(queue, value, priority)", "Adds value with priority.",
    [p("queue","real","Priority queue ID"), p("value","any","Value"), p("priority","real","Priority")], "void", "Data Structures"),
  fn("ds_priority_delete_min", "ds_priority_delete_min(queue)", "Removes and returns minimum priority value.",
    [p("queue","real","Priority queue ID")], "any", "Data Structures"),
  fn("ds_priority_find_min", "ds_priority_find_min(queue)", "Returns minimum priority value without removing.",
    [p("queue","real","Priority queue ID")], "any", "Data Structures"),
  fn("ds_priority_delete_max", "ds_priority_delete_max(queue)", "Removes and returns maximum priority value.",
    [p("queue","real","Priority queue ID")], "any", "Data Structures"),
  fn("ds_priority_find_max", "ds_priority_find_max(queue)", "Returns maximum priority value without removing.",
    [p("queue","real","Priority queue ID")], "any", "Data Structures"),
  fn("ds_priority_size", "ds_priority_size(queue)", "Returns the number of entries.",
    [p("queue","real","Priority queue ID")], "real", "Data Structures"),
  fn("ds_grid_width", "ds_grid_width(grid)", "Returns grid width.",
    [p("grid","real","Grid ID")], "real", "Data Structures"),
  fn("ds_grid_height", "ds_grid_height(grid)", "Returns grid height.",
    [p("grid","real","Grid ID")], "real", "Data Structures"),
  fn("ds_grid_clear", "ds_grid_clear(grid, value)", "Clears all grid cells to a value.",
    [p("grid","real","Grid ID"), p("value","any","Value to set")], "void", "Data Structures"),
  fn("ds_grid_sort", "ds_grid_sort(grid, column, ascending)", "Sorts a grid by column.",
    [p("grid","real","Grid ID"), p("column","real","Column to sort by"), p("ascending","bool","Sort ascending")], "void", "Data Structures"),
  fn("ds_grid_resize", "ds_grid_resize(grid, width, height)", "Resizes a grid.",
    [p("grid","real","Grid ID"), p("width","real","New width"), p("height","real","New height")], "void", "Data Structures"),
  fn("ds_map_find_first", "ds_map_find_first(map)", "Returns the first key in a map.",
    [p("map","real","Map ID")], "string", "Data Structures"),
  fn("ds_map_find_next", "ds_map_find_next(map, key)", "Returns the next key after the given key.",
    [p("map","real","Map ID"), p("key","string","Current key")], "string", "Data Structures"),
  fn("ds_map_replace", "ds_map_replace(map, key, value)", "Replaces value for an existing key.",
    [p("map","real","Map ID"), p("key","string","Key"), p("value","any","New value")], "void", "Data Structures"),
  fn("ds_list_find_index", "ds_list_find_index(list, value)", "Returns index of a value in a list.",
    [p("list","real","List ID"), p("value","any","Value to find")], "real", "Data Structures"),
  fn("ds_list_insert", "ds_list_insert(list, pos, value)", "Inserts a value at a position.",
    [p("list","real","List ID"), p("pos","real","Position"), p("value","any","Value")], "void", "Data Structures"),
  fn("ds_list_replace", "ds_list_replace(list, pos, value)", "Replaces value at a position.",
    [p("list","real","List ID"), p("pos","real","Position"), p("value","any","New value")], "void", "Data Structures"),
  fn("ds_stack_size", "ds_stack_size(stack)", "Returns the number of entries in a stack.",
    [p("stack","real","Stack ID")], "real", "Data Structures"),
  fn("ds_stack_empty", "ds_stack_empty(stack)", "Checks if a stack is empty.",
    [p("stack","real","Stack ID")], "bool", "Data Structures"),
  fn("ds_queue_size", "ds_queue_size(queue)", "Returns the number of entries in a queue.",
    [p("queue","real","Queue ID")], "real", "Data Structures"),
  fn("ds_queue_empty", "ds_queue_empty(queue)", "Checks if a queue is empty.",
    [p("queue","real","Queue ID")], "bool", "Data Structures"),
  fn("ds_queue_head", "ds_queue_head(queue)", "Returns the front value without removing.",
    [p("queue","real","Queue ID")], "any", "Data Structures"),
  fn("ds_queue_tail", "ds_queue_tail(queue)", "Returns the back value without removing.",
    [p("queue","real","Queue ID")], "any", "Data Structures"),
  fn("ds_exists", "ds_exists(id, type)", "Checks if a data structure exists.",
    [p("id","real","Data structure ID"), p("type","constant","ds_type_* constant")], "bool", "Data Structures"),

  // ══════════════════════════════════════
  // Strings
  // ══════════════════════════════════════
  fn("string_length", "string_length(str)", "Returns the length of a string.",
    [p("str","string","Input string")], "real", "Strings"),
  fn("string_pos", "string_pos(substr, str)", "Returns position of substring (1-based, 0 if not found).",
    [p("substr","string","Substring to find"), p("str","string","String to search in")], "real", "Strings"),
  fn("string_copy", "string_copy(str, index, count)", "Returns a substring.",
    [p("str","string","Source string"), p("index","real","Start position (1-based)"), p("count","real","Number of characters")], "string", "Strings"),
  fn("string_delete", "string_delete(str, index, count)", "Deletes characters from a string.",
    [p("str","string","Source string"), p("index","real","Start position (1-based)"), p("count","real","Number of characters")], "string", "Strings"),
  fn("string_insert", "string_insert(substr, str, index)", "Inserts a substring.",
    [p("substr","string","String to insert"), p("str","string","Original string"), p("index","real","Position (1-based)")], "string", "Strings"),
  fn("string_replace", "string_replace(str, old, new_str)", "Replaces first occurrence.",
    [p("str","string","Original string"), p("old","string","String to find"), p("new_str","string","Replacement")], "string", "Strings"),
  fn("string_replace_all", "string_replace_all(str, old, new_str)", "Replaces all occurrences.",
    [p("str","string","Original string"), p("old","string","String to find"), p("new_str","string","Replacement")], "string", "Strings"),
  fn("string_upper", "string_upper(str)", "Converts to uppercase.",
    [p("str","string","Input string")], "string", "Strings"),
  fn("string_lower", "string_lower(str)", "Converts to lowercase.",
    [p("str","string","Input string")], "string", "Strings"),
  fn("string_char_at", "string_char_at(str, index)", "Gets character at position.",
    [p("str","string","Input string"), p("index","real","Position (1-based)")], "string", "Strings"),
  fn("string_digits", "string_digits(str)", "Returns only digit characters from string.",
    [p("str","string","Input string")], "string", "Strings"),
  fn("string_letters", "string_letters(str)", "Returns only letter characters from string.",
    [p("str","string","Input string")], "string", "Strings"),
  fn("string_count", "string_count(substr, str)", "Counts occurrences of substring.",
    [p("substr","string","Substring to count"), p("str","string","String to search")], "real", "Strings"),
  fn("string_format", "string_format(value, total, decimal)", "Formats a number as string.",
    [p("value","real","Number to format"), p("total","real","Total digits"), p("decimal","real","Decimal places")], "string", "Strings"),
  fn("string_hash_to_newline", "string_hash_to_newline(str)", "Converts # to newlines.",
    [p("str","string","Input string")], "string", "Strings"),
  fn("string_pos_ext", "string_pos_ext(substr, str, start_pos)", "Returns position of substring starting from a given position.",
    [p("substr","string","Substring to find"), p("str","string","String to search"), p("start_pos","real","Start position (1-based)")], "real", "Strings"),
  fn("string_last_pos", "string_last_pos(substr, str)", "Returns position of last occurrence of substring.",
    [p("substr","string","Substring"), p("str","string","String")], "real", "Strings"),
  fn("string_last_pos_ext", "string_last_pos_ext(substr, str, start_pos)", "Returns last occurrence before a position.",
    [p("substr","string","Substring"), p("str","string","String"), p("start_pos","real","Search before this position")], "real", "Strings"),
  fn("string_trim", "string_trim(str)", "Removes leading and trailing whitespace.",
    [p("str","string","Input string")], "string", "Strings"),
  fn("string_trim_start", "string_trim_start(str)", "Removes leading whitespace.",
    [p("str","string","Input string")], "string", "Strings"),
  fn("string_trim_end", "string_trim_end(str)", "Removes trailing whitespace.",
    [p("str","string","Input string")], "string", "Strings"),
  fn("string_split", "string_split(str, delimiter, remove_empty)", "Splits a string into an array by delimiter.",
    [p("str","string","Input string"), p("delimiter","string","Delimiter"), p("remove_empty","bool","Remove empty entries",true)], "array", "Strings",
    { example: 'var parts = string_split("a,b,c", ",");' }),
  fn("string_join", "string_join(delimiter, ...values)", "Joins values into a string with a delimiter.",
    [p("delimiter","string","Delimiter"), p("...values","any","Values to join")], "string", "Strings",
    { example: 'var s = string_join(", ", "a", "b", "c"); // "a, b, c"' }),
  fn("string_join_ext", "string_join_ext(delimiter, array, offset, length)", "Joins array elements into a string.",
    [p("delimiter","string","Delimiter"), p("array","array","Array of values"), p("offset","real","Start offset",true), p("length","real","Number of elements",true)], "string", "Strings"),
  fn("string_starts_with", "string_starts_with(str, substr)", "Checks if string starts with substring.",
    [p("str","string","Input string"), p("substr","string","Prefix to check")], "bool", "Strings"),
  fn("string_ends_with", "string_ends_with(str, substr)", "Checks if string ends with substring.",
    [p("str","string","Input string"), p("substr","string","Suffix to check")], "bool", "Strings"),
  fn("string_foreach", "string_foreach(str, callback)", "Calls a function for each character in a string.",
    [p("str","string","Input string"), p("callback","function","Function(character, position)")], "void", "Strings"),
  fn("string_concat", "string_concat(...values)", "Concatenates multiple values into a string.",
    [p("...values","any","Values to concatenate")], "string", "Strings"),
  fn("string_concat_ext", "string_concat_ext(array, offset, length)", "Concatenates array elements into a string.",
    [p("array","array","Array"), p("offset","real","Start offset",true), p("length","real","Length",true)], "string", "Strings"),
  fn("string_repeat", "string_repeat(str, count)", "Repeats a string N times.",
    [p("str","string","String to repeat"), p("count","real","Repeat count")], "string", "Strings"),
  fn("string_lettersdigits", "string_lettersdigits(str)", "Returns only alphanumeric characters.",
    [p("str","string","Input string")], "string", "Strings"),
  fn("string_byte_at", "string_byte_at(str, index)", "Returns byte value at position.",
    [p("str","string","Input string"), p("index","real","Position (1-based)")], "real", "Strings"),
  fn("string_byte_length", "string_byte_length(str)", "Returns the byte length of a string.",
    [p("str","string","Input string")], "real", "Strings"),
  fn("string_set_byte_at", "string_set_byte_at(str, index, value)", "Sets byte value at position.",
    [p("str","string","Input string"), p("index","real","Position"), p("value","real","Byte value")], "string", "Strings"),
  fn("string_ord_at", "string_ord_at(str, index)", "Returns unicode code point at position.",
    [p("str","string","Input string"), p("index","real","Position (1-based)")], "real", "Strings"),
  fn("string_width", "string_width(str)", "Returns pixel width of string using current font.",
    [p("str","string","Input string")], "real", "Strings"),
  fn("string_height", "string_height(str)", "Returns pixel height of string using current font.",
    [p("str","string","Input string")], "real", "Strings"),
  fn("string_width_ext", "string_width_ext(str, sep, w)", "Returns pixel width with line wrapping.",
    [p("str","string","Input string"), p("sep","real","Line height"), p("w","real","Max width")], "real", "Strings"),
  fn("string_height_ext", "string_height_ext(str, sep, w)", "Returns pixel height with line wrapping.",
    [p("str","string","Input string"), p("sep","real","Line height"), p("w","real","Max width")], "real", "Strings"),
  fn("chr", "chr(val)", "Returns the character for a Unicode code point.",
    [p("val","real","Character code")], "string", "Strings"),
  fn("ord", "ord(char)", "Returns the Unicode code point for a character.",
    [p("char","string","Single character")], "real", "Strings"),
  fn("ansi_char", "ansi_char(val)", "Returns the ANSI character for a byte value.",
    [p("val","real","Byte value")], "string", "Strings"),
  fn("real", "real(val)", "Converts a value to a real number.",
    [p("val","any","Value to convert")], "real", "Strings"),
  fn("string", "string(val)", "Converts a value to a string.",
    [p("val","any","Value to convert")], "string", "Strings"),
  fn("bool", "bool(val)", "Converts a value to a boolean.",
    [p("val","any","Value to convert")], "bool", "Strings"),

  // ══════════════════════════════════════
  // Maths And Numbers
  // ══════════════════════════════════════
  fn("random", "random(n)", "Returns a random real number between 0 and n (exclusive).",
    [p("n","real","Upper bound")], "real", "Maths And Numbers"),
  fn("random_range", "random_range(n1, n2)", "Returns a random real between n1 and n2.",
    [p("n1","real","Lower bound"), p("n2","real","Upper bound")], "real", "Maths And Numbers"),
  fn("irandom", "irandom(n)", "Returns a random integer between 0 and n (inclusive).",
    [p("n","real","Upper bound")], "real", "Maths And Numbers"),
  fn("irandom_range", "irandom_range(n1, n2)", "Returns a random integer between n1 and n2 (inclusive).",
    [p("n1","real","Lower bound"), p("n2","real","Upper bound")], "real", "Maths And Numbers"),
  fn("randomize", "randomize()", "Randomizes the random seed.", [], "void", "Maths And Numbers"),
  fn("random_set_seed", "random_set_seed(seed)", "Sets the random seed.",
    [p("seed","real","Seed value")], "void", "Maths And Numbers"),
  fn("random_get_seed", "random_get_seed()", "Gets the current random seed.", [], "real", "Maths And Numbers"),
  fn("choose", "choose(...values)", "Returns one of the arguments at random.",
    [p("...values","any","Values to choose from")], "any", "Maths And Numbers"),
  fn("degtorad", "degtorad(degrees)", "Converts degrees to radians.",
    [p("degrees","real","Angle in degrees")], "real", "Maths And Numbers"),
  fn("radtodeg", "radtodeg(radians)", "Converts radians to degrees.",
    [p("radians","real","Angle in radians")], "real", "Maths And Numbers"),
  fn("lengthdir_x", "lengthdir_x(len, dir)", "Returns X component of a vector.",
    [p("len","real","Length"), p("dir","real","Direction in degrees")], "real", "Maths And Numbers"),
  fn("lengthdir_y", "lengthdir_y(len, dir)", "Returns Y component of a vector.",
    [p("len","real","Length"), p("dir","real","Direction in degrees")], "real", "Maths And Numbers"),
  fn("dot_product", "dot_product(x1, y1, x2, y2)", "Returns the dot product of two 2D vectors.",
    [p("x1","real","X1"), p("y1","real","Y1"), p("x2","real","X2"), p("y2","real","Y2")], "real", "Maths And Numbers"),
  fn("angle_difference", "angle_difference(angle1, angle2)", "Returns shortest angular difference.",
    [p("angle1","real","First angle"), p("angle2","real","Second angle")], "real", "Maths And Numbers"),
  fn("dsin", "dsin(degrees)", "Returns the sine of an angle in degrees.",
    [p("degrees","real","Angle in degrees")], "real", "Maths And Numbers"),
  fn("dcos", "dcos(degrees)", "Returns the cosine of an angle in degrees.",
    [p("degrees","real","Angle in degrees")], "real", "Maths And Numbers"),
  fn("dtan", "dtan(degrees)", "Returns the tangent of an angle in degrees.",
    [p("degrees","real","Angle in degrees")], "real", "Maths And Numbers"),
  fn("darcsin", "darcsin(value)", "Returns arcsine in degrees.",
    [p("value","real","Value (-1 to 1)")], "real", "Maths And Numbers"),
  fn("darccos", "darccos(value)", "Returns arccosine in degrees.",
    [p("value","real","Value (-1 to 1)")], "real", "Maths And Numbers"),
  fn("darctan", "darctan(value)", "Returns arctangent in degrees.",
    [p("value","real","Value")], "real", "Maths And Numbers"),
  fn("darctan2", "darctan2(y, x)", "Returns arctangent of y/x in degrees.",
    [p("y","real","Y"), p("x","real","X")], "real", "Maths And Numbers"),
  fn("dot_product_3d", "dot_product_3d(x1, y1, z1, x2, y2, z2)", "Returns the dot product of two 3D vectors.",
    [p("x1","real","X1"), p("y1","real","Y1"), p("z1","real","Z1"), p("x2","real","X2"), p("y2","real","Y2"), p("z2","real","Z2")], "real", "Maths And Numbers"),
  fn("dot_product_normalised", "dot_product_normalised(x1, y1, x2, y2)", "Returns normalised dot product of two 2D vectors.",
    [p("x1","real","X1"), p("y1","real","Y1"), p("x2","real","X2"), p("y2","real","Y2")], "real", "Maths And Numbers"),
  fn("dot_product_3d_normalised", "dot_product_3d_normalised(x1, y1, z1, x2, y2, z2)", "Returns normalised dot product of two 3D vectors.",
    [p("x1","real","X1"), p("y1","real","Y1"), p("z1","real","Z1"), p("x2","real","X2"), p("y2","real","Y2"), p("z2","real","Z2")], "real", "Maths And Numbers"),
  fn("point_distance_3d", "point_distance_3d(x1, y1, z1, x2, y2, z2)", "Returns distance between two 3D points.",
    [p("x1","real","X1"), p("y1","real","Y1"), p("z1","real","Z1"), p("x2","real","X2"), p("y2","real","Y2"), p("z2","real","Z2")], "real", "Maths And Numbers"),
  fn("math_set_epsilon", "math_set_epsilon(epsilon)", "Sets the epsilon value for floating-point comparisons.",
    [p("epsilon","real","Epsilon value")], "void", "Maths And Numbers"),
  fn("math_get_epsilon", "math_get_epsilon()", "Gets the current epsilon value.", [], "real", "Maths And Numbers"),
  fn("power", "power(x, n)", "Returns x raised to the power n.",
    [p("x","real","Base"), p("n","real","Exponent")], "real", "Maths And Numbers"),
  fn("sqr", "sqr(x)", "Returns x squared.",
    [p("x","real","Value")], "real", "Maths And Numbers"),
  fn("exp", "exp(x)", "Returns e raised to the power x.",
    [p("x","real","Exponent")], "real", "Maths And Numbers"),
  fn("ln", "ln(x)", "Returns the natural logarithm of x.",
    [p("x","real","Value")], "real", "Maths And Numbers"),
  fn("log2", "log2(x)", "Returns the base-2 logarithm of x.",
    [p("x","real","Value")], "real", "Maths And Numbers"),
  fn("log10", "log10(x)", "Returns the base-10 logarithm of x.",
    [p("x","real","Value")], "real", "Maths And Numbers"),
  fn("floor", "floor(x)", "Returns the largest integer less than or equal to x.",
    [p("x","real","Value")], "real", "Maths And Numbers"),
  fn("ceil", "ceil(x)", "Returns the smallest integer greater than or equal to x.",
    [p("x","real","Value")], "real", "Maths And Numbers"),
  fn("round", "round(x)", "Returns the nearest integer to x.",
    [p("x","real","Value")], "real", "Maths And Numbers"),
  fn("abs", "abs(x)", "Returns the absolute value of x.",
    [p("x","real","Value")], "real", "Maths And Numbers"),
  fn("sign", "sign(x)", "Returns -1, 0, or 1 depending on the sign of x.",
    [p("x","real","Value")], "real", "Maths And Numbers"),
  fn("frac", "frac(x)", "Returns the fractional part of x.",
    [p("x","real","Value")], "real", "Maths And Numbers"),
  fn("sqrt", "sqrt(x)", "Returns the square root of x.",
    [p("x","real","Value")], "real", "Maths And Numbers"),
  fn("lerp", "lerp(a, b, amount)", "Linearly interpolates between a and b.",
    [p("a","real","Start value"), p("b","real","End value"), p("amount","real","Interpolation amount (0-1)")], "real", "Maths And Numbers",
    { example: "var val = lerp(0, 100, 0.5); // 50" }),
  fn("clamp", "clamp(value, min, max)", "Clamps a value between min and max.",
    [p("value","real","Input value"), p("min","real","Minimum"), p("max","real","Maximum")], "real", "Maths And Numbers",
    { example: "hp = clamp(hp, 0, max_hp);" }),
  fn("min", "min(...values)", "Returns the smallest of the given values.",
    [p("...values","real","Values to compare")], "real", "Maths And Numbers"),
  fn("max", "max(...values)", "Returns the largest of the given values.",
    [p("...values","real","Values to compare")], "real", "Maths And Numbers"),
  fn("mean", "mean(...values)", "Returns the mean average of the given values.",
    [p("...values","real","Values")], "real", "Maths And Numbers"),
  fn("median", "median(...values)", "Returns the median of the given values.",
    [p("...values","real","Values")], "real", "Maths And Numbers"),

  // ══════════════════════════════════════
  // Surfaces
  // ══════════════════════════════════════
  fn("surface_create", "surface_create(width, height)", "Creates a new surface.",
    [p("width","real","Width"), p("height","real","Height")], "Surface ID", "Surfaces"),
  fn("surface_free", "surface_free(surface)", "Frees a surface.",
    [p("surface","real","Surface ID")], "void", "Surfaces"),
  fn("surface_exists", "surface_exists(surface)", "Checks if a surface exists.",
    [p("surface","real","Surface ID")], "bool", "Surfaces"),
  fn("surface_set_target", "surface_set_target(surface)", "Sets drawing target to a surface.",
    [p("surface","real","Surface ID")], "void", "Surfaces"),
  fn("surface_reset_target", "surface_reset_target()", "Resets drawing target to the application surface.", [], "void", "Surfaces"),
  fn("surface_get_width", "surface_get_width(surface)", "Gets surface width.",
    [p("surface","real","Surface ID")], "real", "Surfaces"),
  fn("surface_get_height", "surface_get_height(surface)", "Gets surface height.",
    [p("surface","real","Surface ID")], "real", "Surfaces"),
  fn("surface_save", "surface_save(surface, filename)", "Saves surface to a PNG file.",
    [p("surface","real","Surface ID"), p("filename","string","File path")], "void", "Surfaces"),
  fn("surface_getpixel", "surface_getpixel(surface, x, y)", "Gets pixel colour from surface.",
    [p("surface","real","Surface ID"), p("x","real","X"), p("y","real","Y")], "real (colour)", "Surfaces"),
  fn("surface_copy", "surface_copy(destination, x, y, source)", "Copies one surface to another.",
    [p("destination","real","Destination surface"), p("x","real","X offset"), p("y","real","Y offset"), p("source","real","Source surface")], "void", "Surfaces"),

  // ══════════════════════════════════════
  // Buffers
  // ══════════════════════════════════════
  fn("buffer_create", "buffer_create(size, type, alignment)", "Creates a new buffer.",
    [p("size","real","Size in bytes"), p("type","constant","buffer_fixed, buffer_grow, buffer_wrap, buffer_fast"), p("alignment","real","Byte alignment")],
    "Buffer ID", "Buffers"),
  fn("buffer_delete", "buffer_delete(buffer)", "Deletes a buffer.",
    [p("buffer","real","Buffer ID")], "void", "Buffers"),
  fn("buffer_write", "buffer_write(buffer, type, value)", "Writes a value to buffer.",
    [p("buffer","real","Buffer ID"), p("type","constant","Data type (e.g. buffer_u8, buffer_f32)"), p("value","any","Value to write")], "void", "Buffers"),
  fn("buffer_read", "buffer_read(buffer, type)", "Reads a value from buffer.",
    [p("buffer","real","Buffer ID"), p("type","constant","Data type to read")], "any", "Buffers"),
  fn("buffer_seek", "buffer_seek(buffer, base, offset)", "Sets buffer read/write position.",
    [p("buffer","real","Buffer ID"), p("base","constant","buffer_seek_start, buffer_seek_relative, buffer_seek_end"), p("offset","real","Byte offset")], "void", "Buffers"),
  fn("buffer_tell", "buffer_tell(buffer)", "Gets current buffer position.",
    [p("buffer","real","Buffer ID")], "real", "Buffers"),
  fn("buffer_get_size", "buffer_get_size(buffer)", "Gets buffer size in bytes.",
    [p("buffer","real","Buffer ID")], "real", "Buffers"),
  fn("buffer_save", "buffer_save(buffer, filename)", "Saves buffer to file.",
    [p("buffer","real","Buffer ID"), p("filename","string","File path")], "void", "Buffers"),
  fn("buffer_load", "buffer_load(filename)", "Loads a buffer from file.",
    [p("filename","string","File path")], "Buffer ID", "Buffers"),
  fn("buffer_copy", "buffer_copy(src, src_offset, size, dest, dest_offset)", "Copies buffer data.",
    [p("src","real","Source buffer"), p("src_offset","real","Source offset"), p("size","real","Bytes to copy"), p("dest","real","Destination buffer"), p("dest_offset","real","Destination offset")], "void", "Buffers"),
  fn("buffer_resize", "buffer_resize(buffer, new_size)", "Resizes a buffer.",
    [p("buffer","real","Buffer ID"), p("new_size","real","New size in bytes")], "void", "Buffers"),
  fn("buffer_fill", "buffer_fill(buffer, offset, type, value, size)", "Fills a buffer with a value.",
    [p("buffer","real","Buffer ID"), p("offset","real","Start offset"), p("type","constant","Data type"), p("value","any","Fill value"), p("size","real","Bytes to fill")], "void", "Buffers"),
  fn("buffer_peek", "buffer_peek(buffer, offset, type)", "Reads a value without moving the position.",
    [p("buffer","real","Buffer ID"), p("offset","real","Byte offset"), p("type","constant","Data type")], "any", "Buffers"),
  fn("buffer_poke", "buffer_poke(buffer, offset, type, value)", "Writes a value without moving the position.",
    [p("buffer","real","Buffer ID"), p("offset","real","Byte offset"), p("type","constant","Data type"), p("value","any","Value")], "void", "Buffers"),
  fn("buffer_save_ext", "buffer_save_ext(buffer, filename, offset, size)", "Saves part of a buffer to file.",
    [p("buffer","real","Buffer ID"), p("filename","string","File path"), p("offset","real","Start offset"), p("size","real","Bytes to save")], "void", "Buffers"),
  fn("buffer_load_ext", "buffer_load_ext(buffer, filename, offset)", "Loads file data into buffer at offset.",
    [p("buffer","real","Buffer ID"), p("filename","string","File path"), p("offset","real","Write offset")], "void", "Buffers"),
  fn("buffer_compress", "buffer_compress(buffer, offset, size)", "Compresses buffer data.",
    [p("buffer","real","Buffer ID"), p("offset","real","Start offset"), p("size","real","Bytes to compress")], "Buffer ID", "Buffers"),
  fn("buffer_decompress", "buffer_decompress(buffer)", "Decompresses a compressed buffer.",
    [p("buffer","real","Buffer ID")], "Buffer ID", "Buffers"),
  fn("buffer_base64_encode", "buffer_base64_encode(buffer, offset, size)", "Encodes buffer data as base64.",
    [p("buffer","real","Buffer ID"), p("offset","real","Start offset"), p("size","real","Bytes")], "string", "Buffers"),
  fn("buffer_base64_decode", "buffer_base64_decode(base64_string)", "Decodes a base64 string into a buffer.",
    [p("base64_string","string","Base64 string")], "Buffer ID", "Buffers"),
  fn("buffer_md5", "buffer_md5(buffer, offset, size)", "Returns MD5 hash of buffer data.",
    [p("buffer","real","Buffer ID"), p("offset","real","Start offset"), p("size","real","Bytes")], "string", "Buffers"),
  fn("buffer_sha1", "buffer_sha1(buffer, offset, size)", "Returns SHA1 hash of buffer data.",
    [p("buffer","real","Buffer ID"), p("offset","real","Start offset"), p("size","real","Bytes")], "string", "Buffers"),
  fn("buffer_crc32", "buffer_crc32(buffer, offset, size)", "Returns CRC32 of buffer data.",
    [p("buffer","real","Buffer ID"), p("offset","real","Start offset"), p("size","real","Bytes")], "real", "Buffers"),
  fn("buffer_get_type", "buffer_get_type(buffer)", "Returns the type of a buffer.",
    [p("buffer","real","Buffer ID")], "constant", "Buffers"),
  fn("buffer_get_alignment", "buffer_get_alignment(buffer)", "Returns the alignment of a buffer.",
    [p("buffer","real","Buffer ID")], "real", "Buffers"),
  fn("buffer_get_surface", "buffer_get_surface(buffer, surface, offset)", "Copies surface data to buffer.",
    [p("buffer","real","Buffer ID"), p("surface","real","Surface ID"), p("offset","real","Buffer offset")], "void", "Buffers"),
  fn("buffer_set_surface", "buffer_set_surface(buffer, surface, offset)", "Copies buffer data to surface.",
    [p("buffer","real","Buffer ID"), p("surface","real","Surface ID"), p("offset","real","Buffer offset")], "void", "Buffers"),
  fn("buffer_exists", "buffer_exists(buffer)", "Checks if a buffer exists.",
    [p("buffer","real","Buffer ID")], "bool", "Buffers"),

  // ══════════════════════════════════════
  // Networking
  // ══════════════════════════════════════
  fn("network_create_server", "network_create_server(type, port, max_clients)", "Creates a network server.",
    [p("type","constant","network_socket_tcp or network_socket_udp"), p("port","real","Port number"), p("max_clients","real","Maximum connected clients")],
    "Server ID", "Networking"),
  fn("network_create_server_raw", "network_create_server_raw(type, port, max_clients)", "Creates a raw network server.",
    [p("type","constant","Socket type"), p("port","real","Port"), p("max_clients","real","Max clients")],
    "Server ID", "Networking"),
  fn("network_create_socket", "network_create_socket(type)", "Creates a network socket.",
    [p("type","constant","network_socket_tcp or network_socket_udp")],
    "Socket ID", "Networking"),
  fn("network_connect", "network_connect(socket, url, port)", "Connects to a server.",
    [p("socket","real","Socket ID"), p("url","string","Server URL/IP"), p("port","real","Port")],
    "real (0=success, <0=error)", "Networking"),
  fn("network_connect_raw", "network_connect_raw(socket, url, port)", "Connects with raw data mode.",
    [p("socket","real","Socket ID"), p("url","string","Server URL/IP"), p("port","real","Port")],
    "real", "Networking"),
  fn("network_send_buffer", "network_send_buffer(socket, buffer, size)", "Sends buffer data over network.",
    [p("socket","real","Socket ID"), p("buffer","real","Buffer ID"), p("size","real","Bytes to send")],
    "real (bytes sent)", "Networking"),
  fn("network_send_packet", "network_send_packet(socket, buffer, size)", "Sends a UDP packet.",
    [p("socket","real","Socket ID"), p("buffer","real","Buffer ID"), p("size","real","Bytes to send")],
    "real (bytes sent)", "Networking"),
  fn("network_send_broadcast", "network_send_broadcast(socket, port, buffer, size)", "Broadcasts a UDP packet.",
    [p("socket","real","Socket ID"), p("port","real","Port"), p("buffer","real","Buffer ID"), p("size","real","Bytes")],
    "real", "Networking"),
  fn("network_destroy", "network_destroy(socket)", "Destroys a network socket or server.",
    [p("socket","real","Socket/server ID")],
    "void", "Networking"),
  fn("network_set_timeout", "network_set_timeout(socket, read_timeout, write_timeout)", "Sets socket timeouts.",
    [p("socket","real","Socket ID"), p("read_timeout","real","Read timeout in ms"), p("write_timeout","real","Write timeout in ms")],
    "void", "Networking"),

  // ══════════════════════════════════════
  // File Handling
  // ══════════════════════════════════════
  fn("file_text_open_read", "file_text_open_read(filename)", "Opens a text file for reading.",
    [p("filename","string","File path")], "File ID", "File Handling"),
  fn("file_text_open_write", "file_text_open_write(filename)", "Opens a text file for writing.",
    [p("filename","string","File path")], "File ID", "File Handling"),
  fn("file_text_open_append", "file_text_open_append(filename)", "Opens a text file for appending.",
    [p("filename","string","File path")], "File ID", "File Handling"),
  fn("file_text_close", "file_text_close(file)", "Closes a text file.",
    [p("file","real","File ID")], "void", "File Handling"),
  fn("file_text_write_string", "file_text_write_string(file, str)", "Writes a string to file.",
    [p("file","real","File ID"), p("str","string","String to write")], "void", "File Handling"),
  fn("file_text_writeln", "file_text_writeln(file)", "Writes a newline to file.",
    [p("file","real","File ID")], "void", "File Handling"),
  fn("file_text_read_string", "file_text_read_string(file)", "Reads a string from file.",
    [p("file","real","File ID")], "string", "File Handling"),
  fn("file_text_readln", "file_text_readln(file)", "Reads a line from file.",
    [p("file","real","File ID")], "string", "File Handling"),
  fn("file_text_eof", "file_text_eof(file)", "Checks if end of file.",
    [p("file","real","File ID")], "bool", "File Handling"),
  fn("file_exists", "file_exists(filename)", "Checks if a file exists.",
    [p("filename","string","File path")], "bool", "File Handling"),
  fn("file_delete", "file_delete(filename)", "Deletes a file.",
    [p("filename","string","File path")], "void", "File Handling"),
  fn("file_rename", "file_rename(oldname, newname)", "Renames a file.",
    [p("oldname","string","Old name"), p("newname","string","New name")], "void", "File Handling"),
  fn("directory_exists", "directory_exists(dirname)", "Checks if directory exists.",
    [p("dirname","string","Directory path")], "bool", "File Handling"),
  fn("directory_create", "directory_create(dirname)", "Creates a directory.",
    [p("dirname","string","Directory path")], "void", "File Handling"),
  fn("ini_open", "ini_open(filename)", "Opens an INI file.",
    [p("filename","string","File path")], "void", "File Handling"),
  fn("ini_close", "ini_close()", "Closes the current INI file.", [], "void", "File Handling"),
  fn("ini_write_string", "ini_write_string(section, key, value)", "Writes string to INI.",
    [p("section","string","Section name"), p("key","string","Key name"), p("value","string","Value")], "void", "File Handling"),
  fn("ini_read_string", "ini_read_string(section, key, default_val)", "Reads string from INI.",
    [p("section","string","Section"), p("key","string","Key"), p("default_val","string","Default value")], "string", "File Handling"),
  fn("ini_write_real", "ini_write_real(section, key, value)", "Writes real to INI.",
    [p("section","string","Section"), p("key","string","Key"), p("value","real","Value")], "void", "File Handling"),
  fn("ini_read_real", "ini_read_real(section, key, default_val)", "Reads real from INI.",
    [p("section","string","Section"), p("key","string","Key"), p("default_val","real","Default value")], "real", "File Handling"),
  fn("ini_section_exists", "ini_section_exists(section)", "Checks if INI section exists.",
    [p("section","string","Section name")], "bool", "File Handling"),
  fn("ini_key_exists", "ini_key_exists(section, key)", "Checks if INI key exists.",
    [p("section","string","Section"), p("key","string","Key")], "bool", "File Handling"),
  fn("ini_section_delete", "ini_section_delete(section)", "Deletes an INI section.",
    [p("section","string","Section name")], "void", "File Handling"),
  fn("ini_key_delete", "ini_key_delete(section, key)", "Deletes an INI key.",
    [p("section","string","Section"), p("key","string","Key")], "void", "File Handling"),
  fn("file_text_write_real", "file_text_write_real(file, value)", "Writes a real number to a text file.",
    [p("file","real","File ID"), p("value","real","Number to write")], "void", "File Handling"),
  fn("file_text_read_real", "file_text_read_real(file)", "Reads a real number from a text file.",
    [p("file","real","File ID")], "real", "File Handling"),
  fn("file_copy", "file_copy(fname, newname)", "Copies a file.",
    [p("fname","string","Source path"), p("newname","string","Destination path")], "void", "File Handling"),
  fn("file_find_first", "file_find_first(mask, attr)", "Finds the first file matching a mask.",
    [p("mask","string","File mask (e.g. '*.txt')"), p("attr","constant","File attributes (fa_* constants)")], "string", "File Handling"),
  fn("file_find_next", "file_find_next()", "Finds the next file matching the previous mask.", [], "string", "File Handling"),
  fn("file_find_close", "file_find_close()", "Closes the file search.", [], "void", "File Handling"),
  fn("file_attributes", "file_attributes(fname, attr)", "Checks file attributes.",
    [p("fname","string","File path"), p("attr","constant","Attribute to check")], "bool", "File Handling"),
  fn("filename_name", "filename_name(fname)", "Returns the filename part of a path.",
    [p("fname","string","File path")], "string", "File Handling"),
  fn("filename_path", "filename_path(fname)", "Returns the directory part of a path.",
    [p("fname","string","File path")], "string", "File Handling"),
  fn("filename_dir", "filename_dir(fname)", "Returns the directory without trailing separator.",
    [p("fname","string","File path")], "string", "File Handling"),
  fn("filename_ext", "filename_ext(fname)", "Returns the file extension.",
    [p("fname","string","File path")], "string", "File Handling"),
  fn("filename_change_ext", "filename_change_ext(fname, newext)", "Changes the file extension.",
    [p("fname","string","File path"), p("newext","string","New extension")], "string", "File Handling"),
  fn("game_save_id", "game_save_id()", "Returns the platform-specific save directory.", [], "string", "File Handling"),
  fn("working_directory", "working_directory", "Built-in variable containing the working directory path.", [], "string", "File Handling"),
  fn("temp_directory", "temp_directory", "Built-in variable containing the temp directory path.", [], "string", "File Handling"),
  fn("program_directory", "program_directory", "Built-in variable containing the program directory path.", [], "string", "File Handling"),
  fn("get_save_filename", "get_save_filename(filter, fname)", "Shows a save file dialog.",
    [p("filter","string","File filter (e.g. 'Text files|*.txt')"), p("fname","string","Default filename")], "string", "File Handling"),
  fn("get_open_filename", "get_open_filename(filter, fname)", "Shows an open file dialog.",
    [p("filter","string","File filter"), p("fname","string","Default filename")], "string", "File Handling"),
  fn("load_csv", "load_csv(filename)", "Loads a CSV file into a DS grid.",
    [p("filename","string","File path")], "DS grid ID", "File Handling"),

  // ══════════════════════════════════════
  // Particles
  // ══════════════════════════════════════
  fn("part_system_create", "part_system_create()", "Creates a particle system.", [], "Particle system ID", "Particles"),
  fn("part_system_destroy", "part_system_destroy(ps)", "Destroys a particle system.",
    [p("ps","real","Particle system ID")], "void", "Particles"),
  fn("part_system_draw_order", "part_system_draw_order(ps, oldtonew)", "Sets draw order.",
    [p("ps","real","Particle system ID"), p("oldtonew","bool","True for old-to-new order")], "void", "Particles"),
  fn("part_system_position", "part_system_position(ps, x, y)", "Sets particle system position.",
    [p("ps","real","Particle system ID"), p("x","real","X"), p("y","real","Y")], "void", "Particles"),
  fn("part_type_create", "part_type_create()", "Creates a particle type.", [], "Particle type ID", "Particles"),
  fn("part_type_destroy", "part_type_destroy(pt)", "Destroys a particle type.",
    [p("pt","real","Particle type ID")], "void", "Particles"),
  fn("part_type_shape", "part_type_shape(pt, shape)", "Sets particle shape.",
    [p("pt","real","Particle type ID"), p("shape","constant","pt_shape_* constant")], "void", "Particles"),
  fn("part_type_size", "part_type_size(pt, size_min, size_max, size_incr, size_wiggle)", "Sets particle size range.",
    [p("pt","real","Type ID"), p("size_min","real","Min size"), p("size_max","real","Max size"), p("size_incr","real","Size increment per step"), p("size_wiggle","real","Size wiggle")], "void", "Particles"),
  fn("part_type_life", "part_type_life(pt, life_min, life_max)", "Sets particle lifetime range.",
    [p("pt","real","Type ID"), p("life_min","real","Min lifetime (steps)"), p("life_max","real","Max lifetime (steps)")], "void", "Particles"),
  fn("part_type_speed", "part_type_speed(pt, speed_min, speed_max, speed_incr, speed_wiggle)", "Sets particle speed.",
    [p("pt","real","Type ID"), p("speed_min","real","Min speed"), p("speed_max","real","Max speed"), p("speed_incr","real","Speed increment"), p("speed_wiggle","real","Speed wiggle")], "void", "Particles"),
  fn("part_type_direction", "part_type_direction(pt, dir_min, dir_max, dir_incr, dir_wiggle)", "Sets particle direction.",
    [p("pt","real","Type ID"), p("dir_min","real","Min direction"), p("dir_max","real","Max direction"), p("dir_incr","real","Direction increment"), p("dir_wiggle","real","Direction wiggle")], "void", "Particles"),
  fn("part_type_gravity", "part_type_gravity(pt, amount, direction)", "Sets particle gravity.",
    [p("pt","real","Type ID"), p("amount","real","Gravity amount"), p("direction","real","Gravity direction")], "void", "Particles"),
  fn("part_type_colour_mix", "part_type_colour_mix(pt, colour1, colour2)", "Sets particle colour mix.",
    [p("pt","real","Type ID"), p("colour1","real","First colour"), p("colour2","real","Second colour")], "void", "Particles"),
  fn("part_type_alpha2", "part_type_alpha2(pt, alpha1, alpha2)", "Sets particle alpha fade.",
    [p("pt","real","Type ID"), p("alpha1","real","Start alpha"), p("alpha2","real","End alpha")], "void", "Particles"),
  fn("part_type_alpha3", "part_type_alpha3(pt, alpha1, alpha2, alpha3)", "Sets three-point particle alpha.",
    [p("pt","real","Type ID"), p("alpha1","real","Start alpha"), p("alpha2","real","Mid alpha"), p("alpha3","real","End alpha")], "void", "Particles"),
  fn("part_emitter_create", "part_emitter_create(ps)", "Creates an emitter for a particle system.",
    [p("ps","real","Particle system ID")], "Emitter ID", "Particles"),
  fn("part_emitter_destroy", "part_emitter_destroy(ps, emitter)", "Destroys a particle emitter.",
    [p("ps","real","Particle system ID"), p("emitter","real","Emitter ID")], "void", "Particles"),
  fn("part_emitter_region", "part_emitter_region(ps, emitter, xmin, xmax, ymin, ymax, shape, distribution)", "Sets emitter region.",
    [p("ps","real","Particle system ID"), p("emitter","real","Emitter ID"), p("xmin","real","X min"), p("xmax","real","X max"), p("ymin","real","Y min"), p("ymax","real","Y max"), p("shape","constant","ps_shape_* constant"), p("distribution","constant","ps_distr_* constant")], "void", "Particles"),
  fn("part_emitter_burst", "part_emitter_burst(ps, emitter, parttype, number)", "Emits a burst of particles.",
    [p("ps","real","Particle system ID"), p("emitter","real","Emitter ID"), p("parttype","real","Particle type ID"), p("number","real","Number of particles")], "void", "Particles"),
  fn("part_emitter_stream", "part_emitter_stream(ps, emitter, parttype, number)", "Streams particles continuously.",
    [p("ps","real","Particle system ID"), p("emitter","real","Emitter ID"), p("parttype","real","Particle type ID"), p("number","real","Particles per step")], "void", "Particles"),
  fn("part_type_sprite", "part_type_sprite(pt, sprite, animate, stretch, random)", "Sets particle type to use a sprite.",
    [p("pt","real","Particle type ID"), p("sprite","sprite","Sprite asset"), p("animate","bool","Animate sub-images"), p("stretch","bool","Stretch animation over lifetime"), p("random","bool","Random sub-image")], "void", "Particles"),
  fn("part_type_colour1", "part_type_colour1(pt, colour)", "Sets particle colour to a single colour.",
    [p("pt","real","Particle type ID"), p("colour","real","Colour")], "void", "Particles"),
  fn("part_type_colour2", "part_type_colour2(pt, colour1, colour2)", "Sets particle colour fade between two colours.",
    [p("pt","real","Particle type ID"), p("colour1","real","Start colour"), p("colour2","real","End colour")], "void", "Particles"),
  fn("part_type_colour3", "part_type_colour3(pt, colour1, colour2, colour3)", "Sets particle three-colour gradient.",
    [p("pt","real","Particle type ID"), p("colour1","real","Start"), p("colour2","real","Middle"), p("colour3","real","End")], "void", "Particles"),
  fn("part_type_alpha1", "part_type_alpha1(pt, alpha)", "Sets particle alpha to a single value.",
    [p("pt","real","Particle type ID"), p("alpha","real","Alpha (0-1)")], "void", "Particles"),
  fn("part_type_scale", "part_type_scale(pt, xscale, yscale)", "Sets particle X and Y scale.",
    [p("pt","real","Particle type ID"), p("xscale","real","X scale"), p("yscale","real","Y scale")], "void", "Particles"),
  fn("part_type_orientation", "part_type_orientation(pt, ang_min, ang_max, ang_incr, ang_wiggle, ang_relative)", "Sets particle rotation.",
    [p("pt","real","Type ID"), p("ang_min","real","Min angle"), p("ang_max","real","Max angle"), p("ang_incr","real","Angle increment"), p("ang_wiggle","real","Angle wiggle"), p("ang_relative","bool","Relative to direction")], "void", "Particles"),
  fn("part_type_blend", "part_type_blend(pt, additive)", "Sets particle blend mode.",
    [p("pt","real","Particle type ID"), p("additive","bool","Use additive blending")], "void", "Particles"),
  fn("part_system_automatic_draw", "part_system_automatic_draw(ps, auto_draw)", "Enables/disables automatic drawing.",
    [p("ps","real","Particle system ID"), p("auto_draw","bool","Auto draw")], "void", "Particles"),
  fn("part_system_update", "part_system_update(ps)", "Manually updates a particle system.",
    [p("ps","real","Particle system ID")], "void", "Particles"),
  fn("part_system_drawit", "part_system_drawit(ps)", "Manually draws a particle system.",
    [p("ps","real","Particle system ID")], "void", "Particles"),
  fn("part_particles_create", "part_particles_create(ps, x, y, parttype, number)", "Creates particles at a position.",
    [p("ps","real","Particle system ID"), p("x","real","X"), p("y","real","Y"), p("parttype","real","Particle type ID"), p("number","real","Count")], "void", "Particles"),
  fn("part_system_clear", "part_system_clear(ps)", "Clears all particles from a system.",
    [p("ps","real","Particle system ID")], "void", "Particles"),
  fn("part_particles_clear", "part_particles_clear(ps)", "Clears all active particles from a system.",
    [p("ps","real","Particle system ID")], "void", "Particles"),
  fn("part_system_layer", "part_system_layer(ps, layer)", "Assigns a particle system to a layer.",
    [p("ps","real","Particle system ID"), p("layer","string|real","Layer name or ID")], "void", "Particles"),
  fn("part_system_depth", "part_system_depth(ps, depth)", "Sets particle system depth.",
    [p("ps","real","Particle system ID"), p("depth","real","Depth value")], "void", "Particles"),
  fn("part_system_exists", "part_system_exists(ps)", "Checks if a particle system exists.",
    [p("ps","real","Particle system ID")], "bool", "Particles"),

  // ══════════════════════════════════════
  // Layers
  // ══════════════════════════════════════
  fn("layer_create", "layer_create(depth, name)", "Creates a new layer.",
    [p("depth","real","Layer depth"), p("name","string","Layer name",true)],
    "Layer ID", "Layers"),
  fn("layer_destroy", "layer_destroy(layer_id)", "Destroys a layer.",
    [p("layer_id","real","Layer ID")], "void", "Layers"),
  fn("layer_exists", "layer_exists(layer_id_or_name)", "Checks if layer exists.",
    [p("layer_id_or_name","real|string","Layer ID or name")], "bool", "Layers"),
  fn("layer_get_id", "layer_get_id(name)", "Gets layer ID from name.",
    [p("name","string","Layer name")], "Layer ID", "Layers"),
  fn("layer_get_depth", "layer_get_depth(layer_id)", "Gets layer depth.",
    [p("layer_id","real","Layer ID")], "real", "Layers"),
  fn("layer_depth", "layer_depth(layer_id, depth)", "Sets layer depth.",
    [p("layer_id","real","Layer ID"), p("depth","real","New depth")], "void", "Layers"),
  fn("layer_get_name", "layer_get_name(layer_id)", "Gets layer name.",
    [p("layer_id","real","Layer ID")], "string", "Layers"),
  fn("layer_set_visible", "layer_set_visible(layer_id, visible)", "Sets layer visibility.",
    [p("layer_id","real","Layer ID"), p("visible","bool","Visible")], "void", "Layers"),
  fn("layer_get_visible", "layer_get_visible(layer_id)", "Gets layer visibility.",
    [p("layer_id","real","Layer ID")], "bool", "Layers"),
  fn("layer_background_create", "layer_background_create(layer_id, sprite)", "Creates a background element on a layer.",
    [p("layer_id","real","Layer ID"), p("sprite","sprite","Sprite asset")], "Background element ID", "Layers"),
  fn("layer_sprite_create", "layer_sprite_create(layer_id, x, y, sprite)", "Creates a sprite element on a layer.",
    [p("layer_id","real","Layer ID"), p("x","real","X"), p("y","real","Y"), p("sprite","sprite","Sprite asset")], "Sprite element ID", "Layers"),
  fn("layer_tilemap_create", "layer_tilemap_create(layer_id, x, y, tileset, width, height)", "Creates a tilemap on a layer.",
    [p("layer_id","real","Layer ID"), p("x","real","X"), p("y","real","Y"), p("tileset","tileset","Tileset asset"), p("width","real","Grid width"), p("height","real","Grid height")], "Tilemap element ID", "Layers"),
  fn("layer_tilemap_get_id", "layer_tilemap_get_id(layer_id)", "Gets the tilemap element from a layer.",
    [p("layer_id","real","Layer ID")], "Tilemap element ID", "Layers"),
  fn("layer_get_all", "layer_get_all()", "Returns an array of all layer IDs in the room.", [], "array", "Layers"),
  fn("layer_get_all_elements", "layer_get_all_elements(layer_id)", "Returns all elements on a layer.",
    [p("layer_id","real","Layer ID")], "array", "Layers"),
  fn("layer_get_element_type", "layer_get_element_type(element_id)", "Returns the type of a layer element.",
    [p("element_id","real","Element ID")], "constant", "Layers"),
  fn("layer_get_target_room", "layer_get_target_room()", "Gets the target room for layer operations.", [], "room", "Layers"),
  fn("layer_set_target_room", "layer_set_target_room(room)", "Sets the target room for layer operations.",
    [p("room","room","Room asset")], "void", "Layers"),
  fn("layer_reset_target_room", "layer_reset_target_room()", "Resets the target room to current room.", [], "void", "Layers"),
  fn("layer_background_get_id", "layer_background_get_id(layer_id)", "Gets the background element from a layer.",
    [p("layer_id","real","Layer ID")], "Background element ID", "Layers"),
  fn("layer_background_visible", "layer_background_visible(element, visible)", "Sets background element visibility.",
    [p("element","real","Background element ID"), p("visible","bool","Visible")], "void", "Layers"),
  fn("layer_background_stretch", "layer_background_stretch(element, stretch)", "Sets background stretching.",
    [p("element","real","Background element ID"), p("stretch","bool","Stretch to fill")], "void", "Layers"),
  fn("layer_background_htiled", "layer_background_htiled(element, tiled)", "Sets horizontal tiling.",
    [p("element","real","Background element ID"), p("tiled","bool","Tile horizontally")], "void", "Layers"),
  fn("layer_background_vtiled", "layer_background_vtiled(element, tiled)", "Sets vertical tiling.",
    [p("element","real","Background element ID"), p("tiled","bool","Tile vertically")], "void", "Layers"),
  fn("layer_background_xscale", "layer_background_xscale(element, xscale)", "Sets background X scale.",
    [p("element","real","Background element ID"), p("xscale","real","X scale")], "void", "Layers"),
  fn("layer_background_yscale", "layer_background_yscale(element, yscale)", "Sets background Y scale.",
    [p("element","real","Background element ID"), p("yscale","real","Y scale")], "void", "Layers"),
  fn("layer_background_speed", "layer_background_speed(element, xspeed, yspeed)", "Sets background scroll speed.",
    [p("element","real","Background element ID"), p("xspeed","real","Horizontal speed"), p("yspeed","real","Vertical speed")], "void", "Layers"),
  fn("tilemap_get", "tilemap_get(tilemap_element_id, cell_x, cell_y)", "Gets a tile at a cell position.",
    [p("tilemap_element_id","real","Tilemap element ID"), p("cell_x","real","Cell X"), p("cell_y","real","Cell Y")], "real (tile data)", "Layers"),
  fn("tilemap_set", "tilemap_set(tilemap_element_id, tiledata, cell_x, cell_y)", "Sets a tile at a cell position.",
    [p("tilemap_element_id","real","Tilemap element ID"), p("tiledata","real","Tile data"), p("cell_x","real","Cell X"), p("cell_y","real","Cell Y")], "void", "Layers"),
  fn("tilemap_get_at_pixel", "tilemap_get_at_pixel(tilemap_element_id, x, y)", "Gets tile data at a pixel position.",
    [p("tilemap_element_id","real","Tilemap element ID"), p("x","real","X pixel"), p("y","real","Y pixel")], "real (tile data)", "Layers"),
  fn("tilemap_set_at_pixel", "tilemap_set_at_pixel(tilemap_element_id, tiledata, x, y)", "Sets tile data at a pixel position.",
    [p("tilemap_element_id","real","Tilemap element ID"), p("tiledata","real","Tile data"), p("x","real","X pixel"), p("y","real","Y pixel")], "void", "Layers"),
  fn("tilemap_get_width", "tilemap_get_width(tilemap_element_id)", "Gets tilemap width in cells.",
    [p("tilemap_element_id","real","Tilemap element ID")], "real", "Layers"),
  fn("tilemap_get_height", "tilemap_get_height(tilemap_element_id)", "Gets tilemap height in cells.",
    [p("tilemap_element_id","real","Tilemap element ID")], "real", "Layers"),
  fn("tilemap_get_cell_x_at_pixel", "tilemap_get_cell_x_at_pixel(tilemap_element_id, x)", "Converts pixel X to cell X.",
    [p("tilemap_element_id","real","Tilemap element ID"), p("x","real","Pixel X")], "real", "Layers"),
  fn("tilemap_get_cell_y_at_pixel", "tilemap_get_cell_y_at_pixel(tilemap_element_id, y)", "Converts pixel Y to cell Y.",
    [p("tilemap_element_id","real","Tilemap element ID"), p("y","real","Pixel Y")], "real", "Layers"),
  fn("tile_set_index", "tile_set_index(tiledata, index)", "Sets the tile index in tile data.",
    [p("tiledata","real","Tile data"), p("index","real","Tile index")], "real (new tile data)", "Layers"),
  fn("tile_get_index", "tile_get_index(tiledata)", "Gets the tile index from tile data.",
    [p("tiledata","real","Tile data")], "real", "Layers"),
  fn("tile_set_flip", "tile_set_flip(tiledata, flip)", "Sets horizontal flip in tile data.",
    [p("tiledata","real","Tile data"), p("flip","bool","Flip")], "real", "Layers"),
  fn("tile_set_mirror", "tile_set_mirror(tiledata, mirror)", "Sets vertical mirror in tile data.",
    [p("tiledata","real","Tile data"), p("mirror","bool","Mirror")], "real", "Layers"),
  fn("tile_set_rotate", "tile_set_rotate(tiledata, rotate)", "Sets rotation in tile data.",
    [p("tiledata","real","Tile data"), p("rotate","bool","Rotate 90 degrees")], "real", "Layers"),

  // ══════════════════════════════════════
  // Variable Functions
  // ══════════════════════════════════════
  fn("variable_instance_exists", "variable_instance_exists(id, name)", "Checks if an instance variable exists.",
    [p("id","instance","Instance ID"), p("name","string","Variable name")], "bool", "Variable Functions"),
  fn("variable_instance_get", "variable_instance_get(id, name)", "Gets an instance variable value.",
    [p("id","instance","Instance ID"), p("name","string","Variable name")], "any", "Variable Functions"),
  fn("variable_instance_set", "variable_instance_set(id, name, value)", "Sets an instance variable.",
    [p("id","instance","Instance ID"), p("name","string","Variable name"), p("value","any","Value to set")], "void", "Variable Functions"),
  fn("variable_instance_get_names", "variable_instance_get_names(id)", "Gets all variable names for an instance.",
    [p("id","instance","Instance ID")], "array of string", "Variable Functions"),
  fn("variable_global_exists", "variable_global_exists(name)", "Checks if a global variable exists.",
    [p("name","string","Variable name")], "bool", "Variable Functions"),
  fn("variable_global_get", "variable_global_get(name)", "Gets a global variable value.",
    [p("name","string","Variable name")], "any", "Variable Functions"),
  fn("variable_global_set", "variable_global_set(name, value)", "Sets a global variable.",
    [p("name","string","Variable name"), p("value","any","Value to set")], "void", "Variable Functions"),
  fn("typeof", "typeof(value)", "Returns the type of a value as a string.",
    [p("value","any","Value to check")], "string", "Variable Functions",
    { example: 'var t = typeof(my_var); // "number", "string", "array", "struct", etc.' }),
  fn("is_string", "is_string(value)", "Checks if a value is a string.",
    [p("value","any","Value to check")], "bool", "Variable Functions"),
  fn("is_real", "is_real(value)", "Checks if a value is a real number.",
    [p("value","any","Value to check")], "bool", "Variable Functions"),
  fn("is_numeric", "is_numeric(value)", "Checks if a value is numeric (real or int64).",
    [p("value","any","Value to check")], "bool", "Variable Functions"),
  fn("is_array", "is_array(value)", "Checks if a value is an array.",
    [p("value","any","Value to check")], "bool", "Variable Functions"),
  fn("is_struct", "is_struct(value)", "Checks if a value is a struct.",
    [p("value","any","Value to check")], "bool", "Variable Functions"),
  fn("is_method", "is_method(value)", "Checks if a value is a method.",
    [p("value","any","Value to check")], "bool", "Variable Functions"),
  fn("is_undefined", "is_undefined(value)", "Checks if a value is undefined.",
    [p("value","any","Value to check")], "bool", "Variable Functions"),
  fn("is_bool", "is_bool(value)", "Checks if a value is a boolean.",
    [p("value","any","Value to check")], "bool", "Variable Functions"),
  fn("is_nan", "is_nan(value)", "Checks if a value is NaN.",
    [p("value","any","Value to check")], "bool", "Variable Functions"),
  fn("is_infinity", "is_infinity(value)", "Checks if a value is infinity.",
    [p("value","any","Value to check")], "bool", "Variable Functions"),
  fn("is_int32", "is_int32(value)", "Checks if a value is a 32-bit integer.",
    [p("value","any","Value to check")], "bool", "Variable Functions"),
  fn("is_int64", "is_int64(value)", "Checks if a value is a 64-bit integer.",
    [p("value","any","Value to check")], "bool", "Variable Functions"),
  fn("is_ptr", "is_ptr(value)", "Checks if a value is a pointer.",
    [p("value","any","Value to check")], "bool", "Variable Functions"),
  fn("is_handle", "is_handle(value)", "Checks if a value is a handle.",
    [p("value","any","Value to check")], "bool", "Variable Functions"),
  fn("instanceof", "instanceof(struct)", "Returns the constructor name of a struct instance.",
    [p("struct","struct","Struct to check")], "string or undefined", "Variable Functions"),
  fn("method", "method(context, function)", "Binds a function to a specific context.",
    [p("context","instance|struct","Context to bind to"), p("function","function","Function to bind")], "method", "Variable Functions",
    { example: "var bound = method(self, my_function);" }),
  fn("method_get_index", "method_get_index(method)", "Returns the script index of a method.",
    [p("method","method","Method variable")], "real", "Variable Functions"),
  fn("method_get_self", "method_get_self(method)", "Returns the context (self) of a method.",
    [p("method","method","Method variable")], "instance|struct", "Variable Functions"),

  // ══════════════════════════════════════
  // Array Functions
  // ══════════════════════════════════════
  fn("array_length", "array_length(array)", "Returns the length of an array.",
    [p("array","array","Array")], "real", "Array Functions"),
  fn("array_push", "array_push(array, ...values)", "Pushes values to end of array.",
    [p("array","array","Array"), p("...values","any","Values to push")], "void", "Array Functions"),
  fn("array_pop", "array_pop(array)", "Removes and returns last element.",
    [p("array","array","Array")], "any", "Array Functions"),
  fn("array_insert", "array_insert(array, index, ...values)", "Inserts values at index.",
    [p("array","array","Array"), p("index","real","Position"), p("...values","any","Values to insert")], "void", "Array Functions"),
  fn("array_delete", "array_delete(array, index, number)", "Deletes elements from array.",
    [p("array","array","Array"), p("index","real","Start position"), p("number","real","Count to delete")], "void", "Array Functions"),
  fn("array_sort", "array_sort(array, sorttype_or_function)", "Sorts an array.",
    [p("array","array","Array"), p("sorttype_or_function","bool|function","true=ascending, false=descending, or custom function")], "void", "Array Functions"),
  fn("array_reverse", "array_reverse(array)", "Reverses array in place.",
    [p("array","array","Array")], "void", "Array Functions"),
  fn("array_shuffle", "array_shuffle(array)", "Shuffles array randomly.",
    [p("array","array","Array")], "void", "Array Functions"),
  fn("array_contains", "array_contains(array, value)", "Checks if array contains a value.",
    [p("array","array","Array"), p("value","any","Value to find")], "bool", "Array Functions"),
  fn("array_find_index", "array_find_index(array, function)", "Finds index of first element matching predicate.",
    [p("array","array","Array"), p("function","function","Predicate function")], "real", "Array Functions"),
  fn("array_filter", "array_filter(array, function)", "Returns new array with elements matching predicate.",
    [p("array","array","Array"), p("function","function","Predicate function")], "array", "Array Functions"),
  fn("array_map", "array_map(array, function)", "Returns new array with function applied to each element.",
    [p("array","array","Array"), p("function","function","Map function")], "array", "Array Functions"),
  fn("array_reduce", "array_reduce(array, function, init)", "Reduces array to single value.",
    [p("array","array","Array"), p("function","function","Reducer function"), p("init","any","Initial value",true)], "any", "Array Functions"),
  fn("array_copy", "array_copy(dest, dest_index, src, src_index, length)", "Copies array elements.",
    [p("dest","array","Destination array"), p("dest_index","real","Dest start"), p("src","array","Source array"), p("src_index","real","Source start"), p("length","real","Elements to copy")], "void", "Array Functions"),
  fn("array_resize", "array_resize(array, new_size)", "Resizes an array.",
    [p("array","array","Array"), p("new_size","real","New size")], "void", "Array Functions"),
  fn("array_create", "array_create(size, value)", "Creates a new array.",
    [p("size","real","Array size"), p("value","any","Default value",true)], "array", "Array Functions",
    { example: "var arr = array_create(10, 0); // [0,0,0,0,0,0,0,0,0,0]" }),
  fn("array_foreach", "array_foreach(array, function)", "Calls a function for each element.",
    [p("array","array","Array"), p("function","function","Callback function(element, index)")], "void", "Array Functions",
    { example: "array_foreach(items, function(item) { show_debug_message(item); });" }),
  fn("array_any", "array_any(array, function)", "Returns true if any element satisfies the predicate.",
    [p("array","array","Array"), p("function","function","Predicate function")], "bool", "Array Functions"),
  fn("array_all", "array_all(array, function)", "Returns true if all elements satisfy the predicate.",
    [p("array","array","Array"), p("function","function","Predicate function")], "bool", "Array Functions"),
  fn("array_concat", "array_concat(array1, array2, ...)", "Concatenates multiple arrays into a new array.",
    [p("array1","array","First array"), p("array2","array","Second array"), p("...","array","Additional arrays",true)], "array", "Array Functions"),
  fn("array_union", "array_union(array1, array2, ...)", "Returns unique elements from multiple arrays.",
    [p("array1","array","First array"), p("array2","array","Second array"), p("...","array","Additional arrays",true)], "array", "Array Functions"),
  fn("array_intersection", "array_intersection(array1, array2, ...)", "Returns elements common to all arrays.",
    [p("array1","array","First array"), p("array2","array","Second array"), p("...","array","Additional arrays",true)], "array", "Array Functions"),
  fn("array_unique", "array_unique(array)", "Returns a new array with duplicate values removed.",
    [p("array","array","Array")], "array", "Array Functions"),
  fn("array_get", "array_get(array, index)", "Gets array element safely (returns undefined for out-of-bounds).",
    [p("array","array","Array"), p("index","real","Index")], "any", "Array Functions"),
  fn("array_set", "array_set(array, index, value)", "Sets an array element, extending the array if needed.",
    [p("array","array","Array"), p("index","real","Index"), p("value","any","Value")], "void", "Array Functions"),
  fn("array_first", "array_first(array)", "Returns the first element of an array.",
    [p("array","array","Array")], "any", "Array Functions"),
  fn("array_last", "array_last(array)", "Returns the last element of an array.",
    [p("array","array","Array")], "any", "Array Functions"),
  fn("array_contains_ext", "array_contains_ext(array, values, match_all)", "Checks if array contains value(s).",
    [p("array","array","Array"), p("values","any|array","Value or array of values"), p("match_all","bool","Require all values match")], "bool", "Array Functions"),
  fn("array_find_last", "array_find_last(array, function)", "Returns last element matching predicate.",
    [p("array","array","Array"), p("function","function","Predicate function")], "any", "Array Functions"),
  fn("array_flat", "array_flat(array, depth)", "Flattens a nested array.",
    [p("array","array","Array"), p("depth","real","Max depth to flatten",true)], "array", "Array Functions"),

  // ══════════════════════════════════════
  // Asset Management
  // ══════════════════════════════════════
  fn("object_exists", "object_exists(object)", "Checks if an object exists.",
    [p("object","real","Object index")], "bool", "Asset Management"),
  fn("object_get_name", "object_get_name(object)", "Gets object name.",
    [p("object","real","Object index")], "string", "Asset Management"),
  fn("object_get_parent", "object_get_parent(object)", "Gets parent object.",
    [p("object","real","Object index")], "real", "Asset Management"),
  fn("object_is_ancestor", "object_is_ancestor(object, ancestor)", "Checks if object inherits from ancestor.",
    [p("object","real","Object to check"), p("ancestor","real","Potential ancestor")], "bool", "Asset Management"),
  fn("object_get_sprite", "object_get_sprite(object)", "Gets the default sprite assigned to an object.",
    [p("object","real","Object index")], "real", "Asset Management"),
  fn("object_get_mask", "object_get_mask(object)", "Gets the collision mask sprite of an object.",
    [p("object","real","Object index")], "real", "Asset Management"),
  fn("object_get_depth", "object_get_depth(object)", "Gets the default depth of an object.",
    [p("object","real","Object index")], "real", "Asset Management"),
  fn("object_get_persistent", "object_get_persistent(object)", "Checks if an object is persistent.",
    [p("object","real","Object index")], "bool", "Asset Management"),
  fn("object_get_visible", "object_get_visible(object)", "Checks if an object is visible by default.",
    [p("object","real","Object index")], "bool", "Asset Management"),
  fn("object_get_solid", "object_get_solid(object)", "Checks if an object is solid by default.",
    [p("object","real","Object index")], "bool", "Asset Management"),
  fn("object_get_physics", "object_get_physics(object)", "Checks if an object uses physics.",
    [p("object","real","Object index")], "bool", "Asset Management"),
  fn("asset_get_index", "asset_get_index(name)", "Gets asset index from name string.",
    [p("name","string","Asset name")], "real", "Asset Management",
    { example: 'var spr = asset_get_index("spr_player");' }),
  fn("asset_get_type", "asset_get_type(name)", "Gets asset type from name string.",
    [p("name","string","Asset name")], "real (asset_type constant)", "Asset Management"),
  fn("font_exists", "font_exists(font)", "Checks if a font exists.",
    [p("font","real","Font index")], "bool", "Asset Management"),
  fn("font_get_name", "font_get_name(font)", "Gets the name of a font.",
    [p("font","real","Font index")], "string", "Asset Management"),
  fn("path_exists", "path_exists(path)", "Checks if a path exists.",
    [p("path","real","Path index")], "bool", "Asset Management"),
  fn("script_exists", "script_exists(script)", "Checks if a script exists.",
    [p("script","real","Script index")], "bool", "Asset Management"),
  fn("script_get_name", "script_get_name(script)", "Gets the name of a script.",
    [p("script","real","Script index")], "string", "Asset Management"),
  fn("timeline_exists", "timeline_exists(timeline)", "Checks if a timeline exists.",
    [p("timeline","real","Timeline index")], "bool", "Asset Management"),
  fn("sprite_create_from_surface", "sprite_create_from_surface(surface, x, y, w, h, removeback, smooth, xorig, yorig)", "Creates sprite from surface.",
    [p("surface","real","Surface ID"), p("x","real","X"), p("y","real","Y"), p("w","real","Width"), p("h","real","Height"), p("removeback","bool","Remove background"), p("smooth","bool","Smooth edges"), p("xorig","real","X origin"), p("yorig","real","Y origin")], "Sprite index", "Asset Management"),
  fn("tag_get_asset_ids", "tag_get_asset_ids(tag, asset_type)", "Gets array of asset IDs with a given tag.",
    [p("tag","string","Tag name"), p("asset_type","constant","Asset type constant")], "array", "Asset Management"),
  fn("asset_has_tags", "asset_has_tags(asset_name, tags)", "Checks if asset has specific tags.",
    [p("asset_name","string","Asset name"), p("tags","string","Comma-separated tags")], "bool", "Asset Management"),

  // ══════════════════════════════════════
  // OS And Compiler
  // ══════════════════════════════════════
  fn("os_get_info", "os_get_info()", "Gets OS information as a DS map.", [], "DS map ID", "OS And Compiler"),
  fn("os_get_language", "os_get_language()", "Gets the OS language code.", [], "string", "OS And Compiler"),
  fn("os_get_region", "os_get_region()", "Gets the OS region code.", [], "string", "OS And Compiler"),
  fn("os_is_paused", "os_is_paused()", "Checks if the app is paused (mobile).", [], "bool", "OS And Compiler"),
  fn("get_timer", "get_timer()", "Gets microseconds since the game started.", [], "real", "OS And Compiler"),
  fn("game_end", "game_end()", "Ends the game.", [], "void", "OS And Compiler"),
  fn("game_restart", "game_restart()", "Restarts the game.", [], "void", "OS And Compiler"),
  fn("parameter_count", "parameter_count()", "Gets number of command line parameters.", [], "real", "OS And Compiler"),
  fn("parameter_string", "parameter_string(n)", "Gets a command line parameter.",
    [p("n","real","Parameter index")], "string", "OS And Compiler"),
  fn("environment_get_variable", "environment_get_variable(name)", "Gets an environment variable.",
    [p("name","string","Variable name")], "string", "OS And Compiler"),
  fn("gml_pragma", "gml_pragma(setting, ...)", "Sets a compiler pragma.",
    [p("setting","string","Pragma type (e.g. 'forceinline', 'global')"), p("...","any","Additional args",true)], "void", "OS And Compiler"),

  // ══════════════════════════════════════
  // Debugging
  // ══════════════════════════════════════
  fn("show_debug_message", "show_debug_message(message)", "Outputs a message to the debug console.",
    [p("message","any","Message to display")], "void", "Debugging"),
  fn("show_message", "show_message(message)", "Shows a message dialog.",
    [p("message","string","Message to display")], "void", "Debugging"),
  fn("show_message_async", "show_message_async(message)", "Shows an async message dialog.",
    [p("message","string","Message to display")], "real (async ID)", "Debugging"),
  fn("show_question", "show_question(message)", "Shows a yes/no question dialog.",
    [p("message","string","Question text")], "bool", "Debugging"),
  fn("show_error", "show_error(message, fatal)", "Shows an error message.",
    [p("message","string","Error message"), p("fatal","bool","If true, game ends after")], "void", "Debugging"),
  fn("debug_get_callstack", "debug_get_callstack()", "Gets the current callstack as an array.", [], "array", "Debugging"),
  fn("exception_unhandled_handler", "exception_unhandled_handler(function)", "Sets handler for unhandled exceptions.",
    [p("function","function","Handler function receiving exception struct")], "void", "Debugging"),

  // ══════════════════════════════════════
  // Garbage Collection
  // ══════════════════════════════════════
  fn("gc_collect", "gc_collect()", "Forces garbage collection.", [], "void", "Garbage Collection"),
  fn("gc_enable", "gc_enable(enable)", "Enables or disables automatic garbage collection.",
    [p("enable","bool","Enable GC")], "void", "Garbage Collection"),
  fn("gc_is_enabled", "gc_is_enabled()", "Checks if GC is enabled.", [], "bool", "Garbage Collection"),
  fn("gc_get_stats", "gc_get_stats()", "Gets GC statistics as a struct.", [], "struct", "Garbage Collection"),
  fn("gc_target_frame_time", "gc_target_frame_time(time)", "Sets target frame time for GC.",
    [p("time","real","Target frame time in microseconds")], "void", "Garbage Collection"),

  // ══════════════════════════════════════
  // Time Sources
  // ══════════════════════════════════════
  fn("time_source_create", "time_source_create(parent, period, units, callback, args, reps, expiry_type)", "Creates a time source.",
    [p("parent","real","Parent time source (time_source_game or time_source_global)"), p("period","real","Time period"), p("units","constant","time_source_units_frames or time_source_units_seconds"), p("callback","function","Callback function"), p("args","array","Callback arguments",true), p("reps","real","Repetitions (-1 for infinite)",true), p("expiry_type","constant","time_source_expire_* constant",true)],
    "Time source ID", "Time Sources"),
  fn("time_source_destroy", "time_source_destroy(ts)", "Destroys a time source.",
    [p("ts","real","Time source ID")], "void", "Time Sources"),
  fn("time_source_start", "time_source_start(ts)", "Starts a time source.",
    [p("ts","real","Time source ID")], "void", "Time Sources"),
  fn("time_source_stop", "time_source_stop(ts)", "Stops a time source.",
    [p("ts","real","Time source ID")], "void", "Time Sources"),
  fn("time_source_pause", "time_source_pause(ts)", "Pauses a time source.",
    [p("ts","real","Time source ID")], "void", "Time Sources"),
  fn("time_source_resume", "time_source_resume(ts)", "Resumes a paused time source.",
    [p("ts","real","Time source ID")], "void", "Time Sources"),
  fn("time_source_exists", "time_source_exists(ts)", "Checks if time source exists.",
    [p("ts","real","Time source ID")], "bool", "Time Sources"),
  fn("time_source_get_state", "time_source_get_state(ts)", "Gets time source state.",
    [p("ts","real","Time source ID")], "constant", "Time Sources"),
  fn("call_later", "call_later(period, units, callback, repeat)", "Simple delayed function call.",
    [p("period","real","Delay period"), p("units","constant","time_source_units_frames or time_source_units_seconds"), p("callback","function","Function to call"), p("repeat","bool","Whether to repeat",true)],
    "Time source ID", "Time Sources"),

  // ══════════════════════════════════════
  // Rooms
  // ══════════════════════════════════════
  fn("room_goto", "room_goto(room)", "Goes to the specified room.",
    [p("room","room","Room asset")], "void", "Rooms", { example: "room_goto(rm_level2);", related: ["room_goto_next", "room_goto_previous", "room_restart"] }),
  fn("room_goto_next", "room_goto_next()", "Goes to the next room in the room order.", [], "void", "Rooms"),
  fn("room_goto_previous", "room_goto_previous()", "Goes to the previous room in the room order.", [], "void", "Rooms"),
  fn("room_restart", "room_restart()", "Restarts the current room.", [], "void", "Rooms"),
  fn("room_next", "room_next(room)", "Returns the next room after the given room.",
    [p("room","room","Room asset")], "room or -1", "Rooms"),
  fn("room_previous", "room_previous(room)", "Returns the previous room before the given room.",
    [p("room","room","Room asset")], "room or -1", "Rooms"),
  fn("room_add", "room_add()", "Creates a new empty room at runtime.", [], "room", "Rooms"),
  fn("room_get_name", "room_get_name(room)", "Returns the name of a room as a string.",
    [p("room","room","Room asset")], "string", "Rooms"),
  fn("room_exists", "room_exists(room)", "Checks if a room exists.",
    [p("room","room","Room index")], "bool", "Rooms"),
  fn("room_set_width", "room_set_width(room, w)", "Sets the width of a room.",
    [p("room","room","Room asset"), p("w","real","Width in pixels")], "void", "Rooms"),
  fn("room_set_height", "room_set_height(room, h)", "Sets the height of a room.",
    [p("room","room","Room asset"), p("h","real","Height in pixels")], "void", "Rooms"),
  fn("room_get_info", "room_get_info(room, ...)", "Returns a struct with room information.",
    [p("room","room","Room asset")], "struct", "Rooms"),
  fn("room_instance_add", "room_instance_add(room, x, y, object)", "Adds an instance to a room (before it's visited).",
    [p("room","room","Room asset"), p("x","real","X"), p("y","real","Y"), p("object","object","Object")], "void", "Rooms"),
  fn("room_instance_clear", "room_instance_clear(room)", "Clears all instances from a room.",
    [p("room","room","Room asset")], "void", "Rooms"),

  // ══════════════════════════════════════
  // Sprites
  // ══════════════════════════════════════
  fn("sprite_get_width", "sprite_get_width(sprite)", "Returns the width of a sprite.",
    [p("sprite","sprite","Sprite asset")], "real", "Sprites", { related: ["sprite_get_height"] }),
  fn("sprite_get_height", "sprite_get_height(sprite)", "Returns the height of a sprite.",
    [p("sprite","sprite","Sprite asset")], "real", "Sprites"),
  fn("sprite_get_xoffset", "sprite_get_xoffset(sprite)", "Returns the X origin offset of a sprite.",
    [p("sprite","sprite","Sprite asset")], "real", "Sprites"),
  fn("sprite_get_yoffset", "sprite_get_yoffset(sprite)", "Returns the Y origin offset of a sprite.",
    [p("sprite","sprite","Sprite asset")], "real", "Sprites"),
  fn("sprite_get_number", "sprite_get_number(sprite)", "Returns the number of sub-images in a sprite.",
    [p("sprite","sprite","Sprite asset")], "real", "Sprites"),
  fn("sprite_get_bbox_left", "sprite_get_bbox_left(sprite)", "Returns the left edge of the bounding box.",
    [p("sprite","sprite","Sprite asset")], "real", "Sprites"),
  fn("sprite_get_bbox_right", "sprite_get_bbox_right(sprite)", "Returns the right edge of the bounding box.",
    [p("sprite","sprite","Sprite asset")], "real", "Sprites"),
  fn("sprite_get_bbox_top", "sprite_get_bbox_top(sprite)", "Returns the top edge of the bounding box.",
    [p("sprite","sprite","Sprite asset")], "real", "Sprites"),
  fn("sprite_get_bbox_bottom", "sprite_get_bbox_bottom(sprite)", "Returns the bottom edge of the bounding box.",
    [p("sprite","sprite","Sprite asset")], "real", "Sprites"),
  fn("sprite_get_name", "sprite_get_name(sprite)", "Returns the name of a sprite as a string.",
    [p("sprite","sprite","Sprite asset")], "string", "Sprites"),
  fn("sprite_get_speed", "sprite_get_speed(sprite)", "Returns the playback speed of a sprite.",
    [p("sprite","sprite","Sprite asset")], "real", "Sprites"),
  fn("sprite_get_speed_type", "sprite_get_speed_type(sprite)", "Returns the speed type (frames per second or frames per game frame).",
    [p("sprite","sprite","Sprite asset")], "constant", "Sprites"),
  fn("sprite_set_offset", "sprite_set_offset(sprite, xoff, yoff)", "Sets the origin offset of a sprite.",
    [p("sprite","sprite","Sprite asset"), p("xoff","real","X offset"), p("yoff","real","Y offset")], "void", "Sprites"),
  fn("sprite_add", "sprite_add(fname, imgnumb, removeback, smooth, xorig, yorig)", "Loads a sprite from a file at runtime.",
    [p("fname","string","File path"), p("imgnumb","real","Number of sub-images"), p("removeback","bool","Remove background"), p("smooth","bool","Smooth edges"), p("xorig","real","X origin"), p("yorig","real","Y origin")], "Sprite index", "Sprites"),
  fn("sprite_replace", "sprite_replace(sprite, fname, imgnumb, removeback, smooth, xorig, yorig)", "Replaces a sprite with an image file.",
    [p("sprite","sprite","Sprite to replace"), p("fname","string","File path"), p("imgnumb","real","Sub-images"), p("removeback","bool","Remove background"), p("smooth","bool","Smooth"), p("xorig","real","X origin"), p("yorig","real","Y origin")], "void", "Sprites"),
  fn("sprite_save", "sprite_save(sprite, subimg, fname)", "Saves a sprite sub-image to a PNG file.",
    [p("sprite","sprite","Sprite asset"), p("subimg","real","Sub-image index"), p("fname","string","File path")], "void", "Sprites"),
  fn("sprite_exists", "sprite_exists(sprite)", "Checks if a sprite asset exists.",
    [p("sprite","sprite","Sprite index")], "bool", "Sprites"),
  fn("sprite_duplicate", "sprite_duplicate(sprite)", "Duplicates a sprite.",
    [p("sprite","sprite","Sprite asset")], "Sprite index", "Sprites"),
  fn("sprite_set_speed", "sprite_set_speed(sprite, speed, type)", "Sets the playback speed of a sprite.",
    [p("sprite","sprite","Sprite asset"), p("speed","real","Speed value"), p("type","constant","spritespeed_framespersecond or spritespeed_framespergameframe")], "void", "Sprites"),

  // ══════════════════════════════════════
  // JSON
  // ══════════════════════════════════════
  fn("json_stringify", "json_stringify(value)", "Converts a struct or array to a JSON string.",
    [p("value","struct|array","Value to stringify")], "string", "JSON",
    { example: 'var str = json_stringify({ name: "Player", hp: 100 });', related: ["json_parse"] }),
  fn("json_parse", "json_parse(json_string)", "Parses a JSON string into a struct or array.",
    [p("json_string","string","JSON string")], "struct|array", "JSON",
    { example: 'var data = json_parse(json_string);', related: ["json_stringify"] }),
  fn("json_encode", "json_encode(ds_map)", "Converts a DS map to a JSON string (legacy).",
    [p("ds_map","real","DS map ID")], "string", "JSON",
    { related: ["json_decode", "json_stringify"] }),
  fn("json_decode", "json_decode(json_string)", "Parses a JSON string into a DS map (legacy).",
    [p("json_string","string","JSON string")], "DS map ID", "JSON",
    { related: ["json_encode", "json_parse"] }),

  // ══════════════════════════════════════
  // Structs
  // ══════════════════════════════════════
  fn("variable_struct_get", "variable_struct_get(struct, name)", "Gets a variable from a struct by name.",
    [p("struct","struct","Struct to read"), p("name","string","Variable name")], "any", "Structs",
    { example: 'var val = variable_struct_get(my_struct, "hp");', related: ["variable_struct_set", "variable_struct_exists"] }),
  fn("variable_struct_set", "variable_struct_set(struct, name, value)", "Sets a variable on a struct by name.",
    [p("struct","struct","Struct to modify"), p("name","string","Variable name"), p("value","any","Value to set")], "void", "Structs",
    { example: 'variable_struct_set(my_struct, "hp", 100);', related: ["variable_struct_get"] }),
  fn("variable_struct_exists", "variable_struct_exists(struct, name)", "Checks if a variable exists on a struct.",
    [p("struct","struct","Struct to check"), p("name","string","Variable name")], "bool", "Structs"),
  fn("variable_struct_remove", "variable_struct_remove(struct, name)", "Removes a variable from a struct.",
    [p("struct","struct","Struct"), p("name","string","Variable name")], "void", "Structs"),
  fn("variable_struct_get_names", "variable_struct_get_names(struct)", "Returns an array of all variable names in a struct.",
    [p("struct","struct","Struct")], "array", "Structs",
    { example: "var names = variable_struct_get_names(my_struct);", related: ["variable_struct_names_count"] }),
  fn("variable_struct_names_count", "variable_struct_names_count(struct)", "Returns the number of variables in a struct.",
    [p("struct","struct","Struct")], "real", "Structs"),
  fn("struct_foreach", "struct_foreach(struct, callback)", "Calls a function for each key-value pair in a struct.",
    [p("struct","struct","Struct to iterate"), p("callback","function","Function(value, key)")], "void", "Structs"),
  fn("struct_exists", "struct_exists(struct, name)", "Alias for variable_struct_exists.",
    [p("struct","struct","Struct"), p("name","string","Variable name")], "bool", "Structs"),
  fn("struct_get", "struct_get(struct, name)", "Alias for variable_struct_get.",
    [p("struct","struct","Struct"), p("name","string","Variable name")], "any", "Structs"),
  fn("struct_set", "struct_set(struct, name, value)", "Alias for variable_struct_set.",
    [p("struct","struct","Struct"), p("name","string","Variable name"), p("value","any","Value")], "void", "Structs"),
  fn("struct_remove", "struct_remove(struct, name)", "Alias for variable_struct_remove.",
    [p("struct","struct","Struct"), p("name","string","Variable name")], "void", "Structs"),
  fn("struct_get_names", "struct_get_names(struct)", "Alias for variable_struct_get_names.",
    [p("struct","struct","Struct")], "array", "Structs"),
  fn("struct_names_count", "struct_names_count(struct)", "Alias for variable_struct_names_count.",
    [p("struct","struct","Struct")], "real", "Structs"),

  // ══════════════════════════════════════
  // HTTP And Async
  // ══════════════════════════════════════
  fn("http_get", "http_get(url)", "Sends an HTTP GET request. Results arrive in Async HTTP event.",
    [p("url","string","URL to request")], "real (async request ID)", "HTTP And Async",
    { example: 'var req = http_get("https://api.example.com/data");', related: ["http_post_string", "http_request"] }),
  fn("http_post_string", "http_post_string(url, body)", "Sends an HTTP POST request with a string body.",
    [p("url","string","URL"), p("body","string","Post body")], "real (async request ID)", "HTTP And Async"),
  fn("http_request", "http_request(url, method, header_map, body)", "Sends a custom HTTP request.",
    [p("url","string","URL"), p("method","string","HTTP method (GET, POST, PUT, DELETE, etc.)"), p("header_map","real","DS map of headers"), p("body","string","Request body")], "real (async request ID)", "HTTP And Async"),
  fn("http_get_file", "http_get_file(url, dest)", "Downloads a file via HTTP GET.",
    [p("url","string","URL"), p("dest","string","Local destination path")], "real (async request ID)", "HTTP And Async"),
  fn("url_open", "url_open(url)", "Opens a URL in the default browser.",
    [p("url","string","URL to open")], "void", "HTTP And Async"),
  fn("url_open_ext", "url_open_ext(url, target)", "Opens a URL with a target parameter.",
    [p("url","string","URL"), p("target","string","Target window name")], "void", "HTTP And Async"),

  // ══════════════════════════════════════
  // Shaders
  // ══════════════════════════════════════
  fn("shader_set", "shader_set(shader)", "Sets the active shader for subsequent drawing.",
    [p("shader","shader","Shader asset")], "void", "Shaders",
    { example: "shader_set(shd_outline);\ndraw_self();\nshader_reset();", related: ["shader_reset", "shader_get_uniform"] }),
  fn("shader_reset", "shader_reset()", "Resets to the default shader.", [], "void", "Shaders"),
  fn("shader_get_uniform", "shader_get_uniform(shader, name)", "Gets the handle of a shader uniform.",
    [p("shader","shader","Shader asset"), p("name","string","Uniform name")], "real (uniform handle)", "Shaders",
    { example: 'var u_color = shader_get_uniform(shd_outline, "u_color");' }),
  fn("shader_set_uniform_f", "shader_set_uniform_f(uniform, ...values)", "Sets a float uniform value.",
    [p("uniform","real","Uniform handle"), p("...values","real","Float values (1-4)")], "void", "Shaders"),
  fn("shader_set_uniform_i", "shader_set_uniform_i(uniform, ...values)", "Sets an integer uniform value.",
    [p("uniform","real","Uniform handle"), p("...values","real","Integer values (1-4)")], "void", "Shaders"),
  fn("shader_set_uniform_matrix", "shader_set_uniform_matrix(uniform)", "Sets a matrix uniform to the current matrix.",
    [p("uniform","real","Uniform handle")], "void", "Shaders"),
  fn("shader_set_uniform_matrix_array", "shader_set_uniform_matrix_array(uniform, array)", "Sets a matrix uniform from an array.",
    [p("uniform","real","Uniform handle"), p("array","array","Matrix array")], "void", "Shaders"),
  fn("shader_set_uniform_f_array", "shader_set_uniform_f_array(uniform, array)", "Sets a float array uniform.",
    [p("uniform","real","Uniform handle"), p("array","array","Float array")], "void", "Shaders"),
  fn("shader_get_sampler_index", "shader_get_sampler_index(shader, name)", "Gets the sampler index for a texture uniform.",
    [p("shader","shader","Shader asset"), p("name","string","Sampler name")], "real", "Shaders"),
  fn("shader_is_compiled", "shader_is_compiled(shader)", "Checks if a shader compiled successfully.",
    [p("shader","shader","Shader asset")], "bool", "Shaders"),
  fn("shader_current", "shader_current()", "Returns the currently active shader.", [], "shader", "Shaders"),
  fn("texture_set_stage", "texture_set_stage(sampler, texture)", "Sets a texture to a sampler stage.",
    [p("sampler","real","Sampler index"), p("texture","real","Texture pointer")], "void", "Shaders"),
  fn("sprite_get_uvs", "sprite_get_uvs(sprite, subimg)", "Gets the UV coordinates of a sprite on its texture page.",
    [p("sprite","sprite","Sprite asset"), p("subimg","real","Sub-image index")], "array", "Shaders"),

  // ══════════════════════════════════════
  // Sequences
  // ══════════════════════════════════════
  fn("sequence_create", "sequence_create()", "Creates a new sequence asset at runtime.", [], "Sequence ID", "Sequences"),
  fn("layer_sequence_create", "layer_sequence_create(layer, x, y, sequence)", "Creates a sequence element on a layer.",
    [p("layer","string|real","Layer name or ID"), p("x","real","X"), p("y","real","Y"), p("sequence","real","Sequence asset")], "Sequence element ID", "Sequences"),
  fn("layer_sequence_destroy", "layer_sequence_destroy(seq_element)", "Destroys a sequence element.",
    [p("seq_element","real","Sequence element ID")], "void", "Sequences"),
  fn("layer_sequence_play", "layer_sequence_play(seq_element)", "Plays a sequence element.",
    [p("seq_element","real","Sequence element ID")], "void", "Sequences"),
  fn("layer_sequence_pause", "layer_sequence_pause(seq_element)", "Pauses a sequence element.",
    [p("seq_element","real","Sequence element ID")], "void", "Sequences"),
  fn("sequence_get", "sequence_get(sequence)", "Returns the sequence struct for a sequence asset.",
    [p("sequence","real","Sequence asset")], "struct", "Sequences"),
  fn("sequence_track_new", "sequence_track_new(type)", "Creates a new track for a sequence.",
    [p("type","constant","Track type constant")], "Track struct", "Sequences"),
  fn("sequence_keyframe_new", "sequence_keyframe_new(type)", "Creates a new keyframe for a sequence track.",
    [p("type","constant","Keyframe type")], "Keyframe struct", "Sequences"),
  fn("sequence_keyframedata_new", "sequence_keyframedata_new(type)", "Creates new keyframe data.",
    [p("type","constant","Data type")], "Keyframe data struct", "Sequences"),

  // ══════════════════════════════════════
  // Effects And Filters
  // ══════════════════════════════════════
  fn("fx_create", "fx_create(filter_or_effect_name)", "Creates a filter/effect struct by name.",
    [p("filter_or_effect_name","string","Name of the effect (e.g. '_filter_colourise')")], "FX struct", "Effects And Filters"),
  fn("layer_set_fx", "layer_set_fx(layer, fx)", "Applies an effect to a layer.",
    [p("layer","string|real","Layer name or ID"), p("fx","struct","FX struct from fx_create")], "void", "Effects And Filters"),
  fn("fx_get_parameter", "fx_get_parameter(fx, param_name)", "Gets a parameter value from an FX struct.",
    [p("fx","struct","FX struct"), p("param_name","string","Parameter name")], "any", "Effects And Filters"),
  fn("fx_set_parameter", "fx_set_parameter(fx, param_name, value)", "Sets a parameter value on an FX struct.",
    [p("fx","struct","FX struct"), p("param_name","string","Parameter name"), p("value","any","Value")], "void", "Effects And Filters"),
  fn("fx_get_parameters", "fx_get_parameters(fx)", "Gets all parameters from an FX struct as an array of structs.",
    [p("fx","struct","FX struct")], "array", "Effects And Filters"),
  fn("layer_get_fx", "layer_get_fx(layer)", "Gets the FX struct applied to a layer.",
    [p("layer","string|real","Layer name or ID")], "FX struct or -1", "Effects And Filters"),
  fn("fx_get_name", "fx_get_name(fx)", "Gets the name of an FX struct.",
    [p("fx","struct","FX struct")], "string", "Effects And Filters"),
];

// ─── Lookup helpers ───
const functionsByName = new Map<string, GmlFunction>();
for (const f of GML_FUNCTIONS) {
  functionsByName.set(f.name.toLowerCase(), f);
}

export function lookupFunction(name: string): GmlFunction | undefined {
  return functionsByName.get(name.toLowerCase());
}

export interface ScoredFunction extends GmlFunction {
  score: number;
}

export function searchFunctions(query: string, category?: string, limit: number = 20): ScoredFunction[] {
  const keywords = query.toLowerCase().split(/\s+/).filter(k => k.length > 0);
  if (keywords.length === 0) return [];

  const results: ScoredFunction[] = [];
  for (const f of GML_FUNCTIONS) {
    if (category && f.category !== category) continue;
    let score = 0;
    const nameLower = f.name.toLowerCase();
    const descLower = f.description.toLowerCase();
    const catLower = f.category.toLowerCase();

    for (const kw of keywords) {
      // Exact name match
      if (nameLower === kw) {
        score += 4;
      } else if (nameLower.includes(kw)) {
        // Word boundary bonus: match after _ or at start
        const idx = nameLower.indexOf(kw);
        if (idx === 0 || nameLower[idx - 1] === "_") {
          score += 3;
        } else {
          score += 2;
        }
      }
      if (descLower.includes(kw)) {
        score += 1.5;
      }
      if (catLower.includes(kw)) {
        score += 1;
      }
    }
    if (score > 0) {
      results.push({ ...f, score });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}

export function getFunctionsByCategory(category: string): GmlFunction[] {
  return GML_FUNCTIONS.filter(f => f.category === category);
}

export function isReservedWord(name: string): boolean {
  return GML_RESERVED_WORDS.includes(name.toLowerCase());
}

// ─── GML Constants Database ───
export interface GmlConstantGroup {
  name: string;
  description: string;
  constants: { name: string; value?: string; description: string }[];
}

export const GML_CONSTANTS: GmlConstantGroup[] = [
  {
    name: "Colours",
    description: "Built-in colour constants",
    constants: [
      { name: "c_aqua", value: "$FFFF00", description: "Aqua/Cyan" },
      { name: "c_black", value: "$000000", description: "Black" },
      { name: "c_blue", value: "$FF0000", description: "Blue" },
      { name: "c_dkgray", value: "$404040", description: "Dark grey" },
      { name: "c_fuchsia", value: "$FF00FF", description: "Fuchsia/Magenta" },
      { name: "c_gray", value: "$808080", description: "Grey" },
      { name: "c_green", value: "$008000", description: "Green" },
      { name: "c_lime", value: "$00FF00", description: "Lime green" },
      { name: "c_ltgray", value: "$C0C0C0", description: "Light grey" },
      { name: "c_maroon", value: "$000080", description: "Maroon" },
      { name: "c_navy", value: "$800000", description: "Navy blue" },
      { name: "c_olive", value: "$008080", description: "Olive" },
      { name: "c_orange", value: "$0080FF", description: "Orange" },
      { name: "c_purple", value: "$800080", description: "Purple" },
      { name: "c_red", value: "$0000FF", description: "Red" },
      { name: "c_silver", value: "$C0C0C0", description: "Silver" },
      { name: "c_teal", value: "$808000", description: "Teal" },
      { name: "c_white", value: "$FFFFFF", description: "White" },
      { name: "c_yellow", value: "$00FFFF", description: "Yellow" },
    ],
  },
  {
    name: "Alignment",
    description: "Font/text alignment constants",
    constants: [
      { name: "fa_left", description: "Left horizontal alignment" },
      { name: "fa_center", description: "Center horizontal alignment" },
      { name: "fa_right", description: "Right horizontal alignment" },
      { name: "fa_top", description: "Top vertical alignment" },
      { name: "fa_middle", description: "Middle vertical alignment" },
      { name: "fa_bottom", description: "Bottom vertical alignment" },
    ],
  },
  {
    name: "Virtual Keys",
    description: "Keyboard virtual key constants",
    constants: [
      { name: "vk_left", description: "Left arrow key" },
      { name: "vk_right", description: "Right arrow key" },
      { name: "vk_up", description: "Up arrow key" },
      { name: "vk_down", description: "Down arrow key" },
      { name: "vk_space", description: "Space bar" },
      { name: "vk_enter", description: "Enter/Return key" },
      { name: "vk_return", description: "Return key (alias for vk_enter)" },
      { name: "vk_shift", description: "Shift key" },
      { name: "vk_control", description: "Control key" },
      { name: "vk_alt", description: "Alt key" },
      { name: "vk_escape", description: "Escape key" },
      { name: "vk_tab", description: "Tab key" },
      { name: "vk_backspace", description: "Backspace key" },
      { name: "vk_delete", description: "Delete key" },
      { name: "vk_insert", description: "Insert key" },
      { name: "vk_home", description: "Home key" },
      { name: "vk_end", description: "End key" },
      { name: "vk_pageup", description: "Page Up key" },
      { name: "vk_pagedown", description: "Page Down key" },
      { name: "vk_pause", description: "Pause key" },
      { name: "vk_printscreen", description: "Print Screen key" },
      { name: "vk_f1", description: "F1 key" },
      { name: "vk_f2", description: "F2 key" },
      { name: "vk_f3", description: "F3 key" },
      { name: "vk_f4", description: "F4 key" },
      { name: "vk_f5", description: "F5 key" },
      { name: "vk_f6", description: "F6 key" },
      { name: "vk_f7", description: "F7 key" },
      { name: "vk_f8", description: "F8 key" },
      { name: "vk_f9", description: "F9 key" },
      { name: "vk_f10", description: "F10 key" },
      { name: "vk_f11", description: "F11 key" },
      { name: "vk_f12", description: "F12 key" },
      { name: "vk_nokey", description: "No key pressed" },
      { name: "vk_anykey", description: "Any key pressed" },
      { name: "vk_lshift", description: "Left Shift" },
      { name: "vk_rshift", description: "Right Shift" },
      { name: "vk_lcontrol", description: "Left Control" },
      { name: "vk_rcontrol", description: "Right Control" },
      { name: "vk_lalt", description: "Left Alt" },
      { name: "vk_ralt", description: "Right Alt" },
    ],
  },
  {
    name: "Mouse Buttons",
    description: "Mouse button constants",
    constants: [
      { name: "mb_left", description: "Left mouse button" },
      { name: "mb_right", description: "Right mouse button" },
      { name: "mb_middle", description: "Middle mouse button" },
      { name: "mb_none", description: "No mouse button" },
      { name: "mb_any", description: "Any mouse button" },
      { name: "mb_side1", description: "Side button 1" },
      { name: "mb_side2", description: "Side button 2" },
    ],
  },
  {
    name: "Gamepad Buttons",
    description: "Gamepad button and axis constants",
    constants: [
      { name: "gp_face1", description: "Face button 1 (A on Xbox, X on PS)" },
      { name: "gp_face2", description: "Face button 2 (B on Xbox, Circle on PS)" },
      { name: "gp_face3", description: "Face button 3 (X on Xbox, Square on PS)" },
      { name: "gp_face4", description: "Face button 4 (Y on Xbox, Triangle on PS)" },
      { name: "gp_shoulderl", description: "Left shoulder button (LB)" },
      { name: "gp_shoulderr", description: "Right shoulder button (RB)" },
      { name: "gp_shoulderlb", description: "Left trigger (LT)" },
      { name: "gp_shoulderrb", description: "Right trigger (RT)" },
      { name: "gp_start", description: "Start/Menu button" },
      { name: "gp_select", description: "Select/Back button" },
      { name: "gp_stickl", description: "Left stick press (L3)" },
      { name: "gp_stickr", description: "Right stick press (R3)" },
      { name: "gp_padu", description: "D-pad up" },
      { name: "gp_padd", description: "D-pad down" },
      { name: "gp_padl", description: "D-pad left" },
      { name: "gp_padr", description: "D-pad right" },
      { name: "gp_axislh", description: "Left stick horizontal axis" },
      { name: "gp_axislv", description: "Left stick vertical axis" },
      { name: "gp_axisrh", description: "Right stick horizontal axis" },
      { name: "gp_axisrv", description: "Right stick vertical axis" },
    ],
  },
  {
    name: "Events",
    description: "Event type constants",
    constants: [
      { name: "ev_create", description: "Create event" },
      { name: "ev_destroy", description: "Destroy event" },
      { name: "ev_step", description: "Step event" },
      { name: "ev_alarm", description: "Alarm event" },
      { name: "ev_keyboard", description: "Keyboard event" },
      { name: "ev_mouse", description: "Mouse event" },
      { name: "ev_collision", description: "Collision event" },
      { name: "ev_other", description: "Other event" },
      { name: "ev_draw", description: "Draw event" },
      { name: "ev_draw_begin", description: "Draw Begin event" },
      { name: "ev_draw_end", description: "Draw End event" },
      { name: "ev_draw_pre", description: "Pre-Draw event" },
      { name: "ev_draw_post", description: "Post-Draw event" },
      { name: "ev_gui", description: "Draw GUI event" },
      { name: "ev_gui_begin", description: "Draw GUI Begin event" },
      { name: "ev_gui_end", description: "Draw GUI End event" },
      { name: "ev_keypress", description: "Key Press event" },
      { name: "ev_keyrelease", description: "Key Release event" },
      { name: "ev_step_begin", description: "Begin Step event" },
      { name: "ev_step_end", description: "End Step event" },
      { name: "ev_step_normal", description: "Normal Step event" },
      { name: "ev_room_start", description: "Room Start event" },
      { name: "ev_room_end", description: "Room End event" },
      { name: "ev_game_start", description: "Game Start event" },
      { name: "ev_game_end", description: "Game End event" },
      { name: "ev_cleanup", description: "Clean Up event" },
      { name: "ev_gesture", description: "Gesture event" },
      { name: "ev_async_web", description: "Async HTTP event" },
      { name: "ev_async_social", description: "Async Social event" },
      { name: "ev_async_save_load", description: "Async Save/Load event" },
      { name: "ev_async_networking", description: "Async Networking event" },
      { name: "ev_async_system_event", description: "Async System event" },
    ],
  },
  {
    name: "Blend Modes",
    description: "Blend mode constants",
    constants: [
      { name: "bm_normal", description: "Normal blending" },
      { name: "bm_add", description: "Additive blending" },
      { name: "bm_subtract", description: "Subtractive blending" },
      { name: "bm_reverse_subtract", description: "Reverse subtractive blending" },
      { name: "bm_max", description: "Max blending" },
      { name: "bm_zero", description: "Blend factor: zero" },
      { name: "bm_one", description: "Blend factor: one" },
      { name: "bm_src_colour", description: "Blend factor: source colour" },
      { name: "bm_inv_src_colour", description: "Blend factor: inverse source colour" },
      { name: "bm_src_alpha", description: "Blend factor: source alpha" },
      { name: "bm_inv_src_alpha", description: "Blend factor: inverse source alpha" },
      { name: "bm_dest_alpha", description: "Blend factor: destination alpha" },
      { name: "bm_inv_dest_alpha", description: "Blend factor: inverse destination alpha" },
      { name: "bm_dest_colour", description: "Blend factor: destination colour" },
      { name: "bm_inv_dest_colour", description: "Blend factor: inverse destination colour" },
      { name: "bm_src_alpha_sat", description: "Blend factor: source alpha saturate" },
    ],
  },
  {
    name: "Data Structure Types",
    description: "Data structure type constants for ds_exists",
    constants: [
      { name: "ds_type_map", description: "DS Map type" },
      { name: "ds_type_list", description: "DS List type" },
      { name: "ds_type_grid", description: "DS Grid type" },
      { name: "ds_type_stack", description: "DS Stack type" },
      { name: "ds_type_queue", description: "DS Queue type" },
      { name: "ds_type_priority", description: "DS Priority Queue type" },
    ],
  },
  {
    name: "Asset Types",
    description: "Asset type constants for asset_get_type",
    constants: [
      { name: "asset_object", description: "Object asset" },
      { name: "asset_sprite", description: "Sprite asset" },
      { name: "asset_sound", description: "Sound asset" },
      { name: "asset_room", description: "Room asset" },
      { name: "asset_path", description: "Path asset" },
      { name: "asset_script", description: "Script asset" },
      { name: "asset_font", description: "Font asset" },
      { name: "asset_timeline", description: "Timeline asset" },
      { name: "asset_tiles", description: "Tileset asset" },
      { name: "asset_shader", description: "Shader asset" },
      { name: "asset_sequence", description: "Sequence asset" },
      { name: "asset_animationcurve", description: "Animation Curve asset" },
      { name: "asset_particlesystem", description: "Particle System asset" },
      { name: "asset_unknown", description: "Unknown asset type" },
    ],
  },
  {
    name: "Primitive Types",
    description: "Primitive drawing type constants",
    constants: [
      { name: "pr_pointlist", description: "Point list primitive" },
      { name: "pr_linelist", description: "Line list primitive" },
      { name: "pr_linestrip", description: "Line strip primitive" },
      { name: "pr_trianglelist", description: "Triangle list primitive" },
      { name: "pr_trianglestrip", description: "Triangle strip primitive" },
      { name: "pr_trianglefan", description: "Triangle fan primitive" },
    ],
  },
  {
    name: "Buffer Types",
    description: "Buffer type and data type constants",
    constants: [
      { name: "buffer_fixed", description: "Fixed-size buffer" },
      { name: "buffer_grow", description: "Growable buffer" },
      { name: "buffer_wrap", description: "Wrapping buffer" },
      { name: "buffer_fast", description: "Fast buffer (1-byte alignment)" },
      { name: "buffer_u8", description: "Unsigned 8-bit integer (0-255)" },
      { name: "buffer_s8", description: "Signed 8-bit integer (-128 to 127)" },
      { name: "buffer_u16", description: "Unsigned 16-bit integer" },
      { name: "buffer_s16", description: "Signed 16-bit integer" },
      { name: "buffer_u32", description: "Unsigned 32-bit integer" },
      { name: "buffer_s32", description: "Signed 32-bit integer" },
      { name: "buffer_u64", description: "Unsigned 64-bit integer" },
      { name: "buffer_f16", description: "16-bit float (half precision)" },
      { name: "buffer_f32", description: "32-bit float" },
      { name: "buffer_f64", description: "64-bit float (double precision)" },
      { name: "buffer_bool", description: "Boolean value" },
      { name: "buffer_string", description: "Null-terminated string" },
      { name: "buffer_text", description: "String without null terminator" },
      { name: "buffer_seek_start", description: "Seek from buffer start" },
      { name: "buffer_seek_relative", description: "Seek from current position" },
      { name: "buffer_seek_end", description: "Seek from buffer end" },
    ],
  },
  {
    name: "Particle Shapes",
    description: "Built-in particle shape constants",
    constants: [
      { name: "pt_shape_pixel", description: "Single pixel" },
      { name: "pt_shape_disk", description: "Filled circle" },
      { name: "pt_shape_square", description: "Filled square" },
      { name: "pt_shape_line", description: "Line" },
      { name: "pt_shape_star", description: "Star shape" },
      { name: "pt_shape_circle", description: "Circle outline" },
      { name: "pt_shape_ring", description: "Ring shape" },
      { name: "pt_shape_sphere", description: "Sphere shape" },
      { name: "pt_shape_flare", description: "Lens flare" },
      { name: "pt_shape_spark", description: "Spark" },
      { name: "pt_shape_explosion", description: "Explosion" },
      { name: "pt_shape_cloud", description: "Cloud" },
      { name: "pt_shape_smoke", description: "Smoke" },
      { name: "pt_shape_snow", description: "Snowflake" },
    ],
  },
  {
    name: "Cursor Shapes",
    description: "Mouse cursor constants",
    constants: [
      { name: "cr_default", description: "Default cursor" },
      { name: "cr_none", description: "No cursor" },
      { name: "cr_arrow", description: "Arrow cursor" },
      { name: "cr_cross", description: "Crosshair cursor" },
      { name: "cr_beam", description: "Text beam cursor" },
      { name: "cr_size_nesw", description: "NE-SW resize cursor" },
      { name: "cr_size_ns", description: "N-S resize cursor" },
      { name: "cr_size_nwse", description: "NW-SE resize cursor" },
      { name: "cr_size_we", description: "W-E resize cursor" },
      { name: "cr_uparrow", description: "Up arrow cursor" },
      { name: "cr_hourglass", description: "Hourglass/wait cursor" },
      { name: "cr_drag", description: "Drag cursor" },
      { name: "cr_handpoint", description: "Hand pointing cursor" },
      { name: "cr_size_all", description: "Move/resize all cursor" },
    ],
  },
  {
    name: "Horizontal/Vertical",
    description: "Orientation constants",
    constants: [
      { name: "true", description: "Boolean true (1)" },
      { name: "false", description: "Boolean false (0)" },
      { name: "undefined", description: "Undefined value" },
      { name: "pointer_null", description: "Null pointer" },
      { name: "pointer_invalid", description: "Invalid pointer" },
      { name: "NaN", description: "Not a Number" },
      { name: "infinity", description: "Positive infinity" },
      { name: "pi", description: "Pi (~3.14159265358979)" },
      { name: "noone", description: "No instance (-4)" },
      { name: "all", description: "All instances (-3)" },
      { name: "self", description: "Current instance (-1)" },
      { name: "other", description: "Other instance in collision (-2)" },
      { name: "global", description: "Global scope" },
    ],
  },
  {
    name: "Network",
    description: "Network type and config constants",
    constants: [
      { name: "network_socket_tcp", description: "TCP socket type" },
      { name: "network_socket_udp", description: "UDP socket type" },
      { name: "network_socket_ws", description: "WebSocket type" },
      { name: "network_socket_wss", description: "Secure WebSocket type" },
      { name: "network_type_connect", description: "Client connected event" },
      { name: "network_type_disconnect", description: "Client disconnected event" },
      { name: "network_type_data", description: "Data received event" },
      { name: "network_type_non_blocking_connect", description: "Non-blocking connect result" },
      { name: "network_config_connect_timeout", description: "Connection timeout config" },
      { name: "network_config_use_non_blocking_socket", description: "Non-blocking socket config" },
    ],
  },
  {
    name: "Time Source",
    description: "Time source constants",
    constants: [
      { name: "time_source_game", description: "Game time source (pauses with game)" },
      { name: "time_source_global", description: "Global time source (always runs)" },
      { name: "time_source_units_frames", description: "Period measured in frames" },
      { name: "time_source_units_seconds", description: "Period measured in seconds" },
      { name: "time_source_expire_nearest", description: "Expire at nearest frame" },
      { name: "time_source_expire_after", description: "Expire after the period" },
      { name: "time_source_state_initial", description: "Not yet started" },
      { name: "time_source_state_active", description: "Currently running" },
      { name: "time_source_state_paused", description: "Paused" },
      { name: "time_source_state_stopped", description: "Stopped" },
    ],
  },
  {
    name: "Cull Modes",
    description: "GPU face culling constants",
    constants: [
      { name: "cull_noculling", description: "No face culling" },
      { name: "cull_clockwise", description: "Cull clockwise faces" },
      { name: "cull_counterclockwise", description: "Cull counter-clockwise faces" },
    ],
  },
  {
    name: "Particle Distribution",
    description: "Particle emitter shape and distribution constants",
    constants: [
      { name: "ps_shape_rectangle", description: "Rectangle emitter shape" },
      { name: "ps_shape_ellipse", description: "Ellipse emitter shape" },
      { name: "ps_shape_diamond", description: "Diamond emitter shape" },
      { name: "ps_shape_line", description: "Line emitter shape" },
      { name: "ps_distr_linear", description: "Linear distribution" },
      { name: "ps_distr_gaussian", description: "Gaussian distribution" },
      { name: "ps_distr_invgaussian", description: "Inverse Gaussian distribution" },
    ],
  },
  {
    name: "Sprite Speed",
    description: "Sprite speed type constants",
    constants: [
      { name: "spritespeed_framespersecond", description: "Speed in frames per second" },
      { name: "spritespeed_framespergameframe", description: "Speed in frames per game frame" },
    ],
  },
  {
    name: "OS Types",
    description: "Operating system type constants",
    constants: [
      { name: "os_windows", description: "Windows" },
      { name: "os_macosx", description: "macOS" },
      { name: "os_linux", description: "Linux" },
      { name: "os_ios", description: "iOS" },
      { name: "os_android", description: "Android" },
      { name: "os_tvos", description: "tvOS" },
      { name: "os_ps4", description: "PlayStation 4" },
      { name: "os_ps5", description: "PlayStation 5" },
      { name: "os_xboxone", description: "Xbox One" },
      { name: "os_xboxseriesxs", description: "Xbox Series X|S" },
      { name: "os_switch", description: "Nintendo Switch" },
      { name: "os_gxgames", description: "GX.games (Opera)" },
    ],
  },
  {
    name: "File Attributes",
    description: "File attribute constants for file_find_first",
    constants: [
      { name: "fa_none", description: "No attributes (regular files)" },
      { name: "fa_readonly", description: "Read-only files" },
      { name: "fa_hidden", description: "Hidden files" },
      { name: "fa_sysfile", description: "System files" },
      { name: "fa_volumeid", description: "Volume ID files" },
      { name: "fa_directory", description: "Directories" },
      { name: "fa_archive", description: "Archive files" },
    ],
  },
  {
    name: "Audio",
    description: "Audio falloff and group constants",
    constants: [
      { name: "audio_falloff_none", description: "No falloff" },
      { name: "audio_falloff_inverse_distance", description: "Inverse distance falloff" },
      { name: "audio_falloff_inverse_distance_clamped", description: "Inverse distance (clamped)" },
      { name: "audio_falloff_linear_distance", description: "Linear distance falloff" },
      { name: "audio_falloff_linear_distance_clamped", description: "Linear distance (clamped)" },
      { name: "audio_falloff_exponent_distance", description: "Exponent distance falloff" },
      { name: "audio_falloff_exponent_distance_clamped", description: "Exponent distance (clamped)" },
    ],
  },
  {
    name: "Layer Element Types",
    description: "Layer element type constants",
    constants: [
      { name: "layerelementtype_undefined", description: "Undefined element" },
      { name: "layerelementtype_background", description: "Background element" },
      { name: "layerelementtype_instance", description: "Instance element" },
      { name: "layerelementtype_oldtilemap", description: "Legacy tilemap element" },
      { name: "layerelementtype_sprite", description: "Sprite element" },
      { name: "layerelementtype_tilemap", description: "Tilemap element" },
      { name: "layerelementtype_particlesystem", description: "Particle system element" },
      { name: "layerelementtype_sequence", description: "Sequence element" },
    ],
  },
];

// ─── GML Language Concepts ───
// Semantic/behavioral knowledge that cannot be expressed as function signatures

export interface GmlConcept {
  name: string;
  category: string;
  summary: string;
  details: string;
  pitfalls: string[];
  example?: string;
  related?: string[];
}

export const GML_CONCEPT_CATEGORIES = [
  "Scoping", "Events", "Instance Management",
  "Object Oriented", "Variables", "Memory And Performance",
  "Async", "Rendering", "Room Management",
] as const;

export const GML_CONCEPTS: GmlConcept[] = [

  // ══════════════════════════════════════
  // Scoping
  // ══════════════════════════════════════
  {
    name: "with スコープ変化",
    category: "Scoping",
    summary: "with(target) ブロック内では self が target インスタンスに変わり、呼び出し元が other になる。",
    details: `with 文はコンテキスト (self) を指定したターゲットの各インスタンスに切り替えて処理を実行する。
- ブロック内での self = ターゲットインスタンス
- ブロック内での other = with を呼び出したインスタンス (元の self)
- ターゲットが存在しない場合はブロックがスキップされる (エラーにはならない)
- with (all) で全インスタンス、with (object_name) でそのオブジェクトの全インスタンスを対象にできる`,
    pitfalls: [
      "with(obj_enemy) 内から obj_game のメソッドを呼ぶと、self が obj_enemy になっているため「not set before reading」エラーが発生する",
      "呼び出し元を参照するには with の外で var _caller = id; と保持してから _caller.my_method() と呼ぶ",
      "または with ブロック内で other.my_method() と書く",
      "with 内の var 変数は各イテレーションで独立したローカル変数になる",
    ],
    example: `// NG: obj_game のメソッドが見つからない
with (obj_enemy) {
    spawn_fx(x, y); // self = obj_enemy なので見つからない
}

// OK: 呼び出し元を保持する
var _game = id;
with (obj_enemy) {
    _game.spawn_fx(x, y); // 明示的に obj_game を参照
}

// OK: other を使う (with を呼んだ側が self だった場合)
with (obj_enemy) {
    other.spawn_fx(x, y);
}`,
    related: ["other", "self", "id", "all", "noone"],
  },

  {
    name: "var ローカルスコープ",
    category: "Scoping",
    summary: "var で宣言した変数はイベント/スクリプト全体がスコープ。ブロックスコープではない。",
    details: `GML の var 変数はスクリプトやイベント全体がスコープ (C言語の関数スコープに近い)。
- if や for ブロックの中で宣言しても、ブロック外からアクセスできる
- var を付けないとインスタンス変数として扱われ、オブジェクトに永続する
- スクリプト (function) 内の var はその関数スコープ
- static を付けると関数呼び出し間で値が保持される`,
    pitfalls: [
      "var を付け忘れると意図せずインスタンス変数が作成される",
      "for ループ内で宣言した var はループ外でも生存するため、同名変数を再利用できてしまう (バグの温床)",
      "グローバル変数には必ず global. プレフィックスを付ける",
    ],
    example: `// var のスコープはイベント全体
if (hp <= 0) {
    var _msg = "dead"; // ブロック外からも参照可能
}
show_debug_message(_msg); // アクセスできてしまう (意図しない場合はバグ)

// インスタンス変数との違い
hp = 100;        // インスタンス変数 (self.hp = 100 と同じ)
var _temp = 100; // ローカル変数 (このイベント/関数のみ)`,
    related: ["variable_instance_get", "variable_global_get", "static"],
  },

  {
    name: "self / other / id の使い分け",
    category: "Scoping",
    summary: "self は現在のコンテキスト、id は実際のインスタンスID、other はコンテキスト依存の相手インスタンス。",
    details: `- self: 現在実行中のコンテキスト。with や method で変わる
- id: そのインスタンスの実際のID (変わらない)。with 内で保持する際に使う
- other: コリジョンイベントでは相手インスタンス、with 内では呼び出し元インスタンス
- global: グローバルスコープへのアクセス
- noone (-4): インスタンスなしを表す定数。instance_exists のチェックに使う`,
    pitfalls: [
      "with ブロック内で id を使うとターゲットインスタンスの id になる (呼び出し元の id ではない)",
      "メソッド (method()) をバインドした場合、self はバインド先になる",
      "コリジョンイベント以外で other を使うと undefined 参照になる場合がある",
    ],
    example: `// with の前に id を保存
var _me = id; // ここでの id = obj_game の id
with (obj_enemy) {
    // ここでの id = obj_enemy の id
    // ここでの other = obj_game のインスタンス
    _me.notify(id); // _me = 元の obj_game
}`,
    related: ["instance_exists", "instanceof", "method"],
  },

  {
    name: "グローバル変数",
    category: "Scoping",
    summary: "global. プレフィックスを付けた変数はゲーム全体で共有される。宣言は最初の代入で行われる。",
    details: `global 変数はすべてのオブジェクト・スクリプトからアクセス可能な共有変数。
- global.my_var = value; で宣言と代入を同時に行う
- globalvar キーワードは非推奨 (使わないこと)
- global 変数はゲーム終了まで保持される
- ルーム遷移でも保持される (persistent オブジェクトと違い自動)`,
    pitfalls: [
      "global. プレフィックスを忘れると同名のインスタンス変数が作られてしまう",
      "global 変数は初期化前に読み取るとエラーになる。必ず obj_game のCreate等で初期化する",
      "struct の中では global. が必要 (struct は自身のスコープを持つ)",
    ],
    example: `// obj_game Create イベントで初期化
global.score = 0;
global.player_hp = 100;

// どこからでもアクセス
global.score += 10;
if (global.player_hp <= 0) { /* ... */ }`,
    related: ["variable_global_get", "variable_global_set", "variable_global_exists"],
  },

  // ══════════════════════════════════════
  // Events
  // ══════════════════════════════════════
  {
    name: "イベント実行順",
    category: "Events",
    summary: "1フレームのイベント実行順: Begin Step → Alarm → Keyboard/Mouse → Step → Collision → End Step → Draw",
    details: `GameMaker のイベント実行順 (1フレーム):
1. Begin Step (全インスタンス)
2. Alarm (全インスタンス)
3. Keyboard / Mouse / Other イベント
4. Step (全インスタンス)
5. Collision イベント
6. End Step (全インスタンス)
7. Draw Begin → Draw → Draw End (depth 降順)
8. Draw GUI Begin → Draw GUI → Draw GUI End

描画イベント内での注意:
- Draw イベントは Room 座標系で描画
- Draw GUI イベントは GUI 座標系 (カメラに関係なく固定) で描画`,
    pitfalls: [
      "Draw イベントで draw_self() を呼ばないと、visible=true でもスプライトが描画されない",
      "Draw GUI でゲームワールドの座標を使うと位置がズレる (カメラ変換が必要)",
      "Step より Begin Step の方が先なので、初期化系処理は Begin Step に置くと安全",
      "Collision イベントは Step の後なので、同フレームの移動結果に対して判定される",
    ],
    example: `// Draw GUI でルーム座標をGUI座標に変換する例
var _cam = view_camera[0];
var _sx = (room_x - camera_get_view_x(_cam)) / camera_get_view_width(_cam) * display_get_gui_width();
var _sy = (room_y - camera_get_view_y(_cam)) / camera_get_view_height(_cam) * display_get_gui_height();
draw_text(_sx, _sy, "text");`,
    related: ["event_perform", "event_inherited", "draw_self"],
  },

  {
    name: "Create イベントの実行タイミング",
    category: "Events",
    summary: "Create イベントは instance_create_* の呼び出しと同じフレーム内、呼び出し直後に実行される。",
    details: `instance_create_layer() や instance_create_depth() を呼ぶと、Create イベントが即座に実行される。
- 呼び出し元の Step イベントがまだ実行中でも Create は割り込む
- そのため Create 内でアクセスする global 変数は、呼び出し前に初期化されている必要がある
- 戻り値 (インスタンスID) を受け取った後に変数を設定するパターンが一般的`,
    pitfalls: [
      "var inst = instance_create_layer(...); inst.my_var = 10; のとき、Create イベントは inst.my_var = 10 の前に実行される",
      "Create イベントで他のオブジェクトを参照する場合は instance_exists でチェックする",
    ],
    example: `// Create が先に走るためこの順番に注意
var _bullet = instance_create_layer(x, y, "Bullets", obj_bullet);
// ↑ここで obj_bullet の Create が実行される
_bullet.damage = 10; // Create の後で変数を上書き設定する`,
    related: ["instance_create_layer", "instance_create_depth", "event_perform"],
  },

  {
    name: "Destroy イベントと instance_destroy",
    category: "Events",
    summary: "instance_destroy() は即座にインスタンスを削除するのではなく、現在のイベントが終わった後に処理される。",
    details: `instance_destroy() を呼んでも、現在のイベントコードは最後まで実行される。
- Destroy イベントは instance_destroy の後、実際に削除される前に実行される
- with (obj_enemy) 内で instance_destroy() を呼ぶと、with ループの残りの反復は継続する
- 削除予定のインスタンスに続けてアクセスしても、同フレーム内なら有効`,
    pitfalls: [
      "instance_destroy(_enemy) の直後に _enemy.x にアクセスしても、同フレームならまだ有効",
      "ただし次フレームでは無効なので instance_exists() でチェックすること",
      "with ループ中に instance_destroy(id) しても残りのインスタンスの処理は続く",
    ],
    example: `var _enemy = get_enemy_at(nx, ny);
if (_enemy != noone) {
    var _ex = _enemy.x; // 安全: まだ存在する
    instance_destroy(_enemy);
    spawn_fx(_ex, _enemy.y); // 同フレームなら _enemy.y もまだ有効
}
// 次フレームでは instance_exists(_enemy) == false`,
    related: ["instance_destroy", "instance_exists", "event_inherited"],
  },

  {
    name: "Alarm イベント",
    category: "Events",
    summary: "alarm[n] にフレーム数をセットするとカウントダウンし、0になったときに Alarm[n] イベントが発火する。",
    details: `alarm は 0〜11 の12個が利用可能 (alarm[0] 〜 alarm[11])。
- alarm[n] = frames; でセット (-1 にすると無効化)
- カウントダウンは Step ごとに1減少
- 0になった瞬間にイベントが発火し、-1 にリセットされる
- ループさせたい場合はイベント内で再セットする`,
    pitfalls: [
      "alarm[n] = 0 はそのフレームの Step 後にイベントが発火する (即時ではない)",
      "alarm[n] = 1 は次のフレームで発火",
      "alarm イベントはインスタンスが destroy されると自動でキャンセルされる",
      "room 遷移でも persistent でないインスタンスの alarm は消える",
    ],
    example: `// Create イベント
alarm[0] = 120; // 2秒後に発火 (60fps想定)

// Alarm[0] イベント
spawn_enemy(irandom(room_width), irandom(room_height));
alarm[0] = 120; // ループ: 再セット`,
    related: ["call_later", "time_source_create"],
  },

  // ══════════════════════════════════════
  // Instance Management
  // ══════════════════════════════════════
  {
    name: "persistent オブジェクト",
    category: "Instance Management",
    summary: "persistent=true のインスタンスはルーム遷移後も破棄されず、全ルームを通じて存在し続ける。",
    details: `persistent フラグが true のインスタンスはルームが変わっても自動的に次のルームに持ち越される。
- obj_game のような「ゲーム全体を管理するオブジェクト」に使う
- Create イベントはゲーム開始時の1回のみ実行される (ルーム遷移では実行されない)
- Room Start イベントはルームに入るたびに実行される (persistent でも)
- instance_destroy() で明示的に破棄するまで存在し続ける`,
    pitfalls: [
      "ゲームリスタート (game_restart) でも persistent インスタンスが残ることがある",
      "同じオブジェクトを新しいルームでも配置してあると2つ存在してしまう",
      "persistent インスタンスは Room End / Room Start イベントが実行されるが Create は実行されない",
    ],
    example: `// obj_game の Create (ゲーム開始時に1回だけ)
global.score = 0;
global.floor = 1;

// obj_game の Other > Room Start (ルームに入るたび)
// ここでルーム固有の初期化を行う
spawn_enemies_for_floor(global.floor);`,
    related: ["room_goto", "game_restart", "instance_destroy"],
  },

  {
    name: "インスタンス検索と noone チェック",
    category: "Instance Management",
    summary: "instance_nearest や collision 関数は見つからない場合 noone を返す。必ず noone チェックをする。",
    details: `インスタンスを返す関数群は見つからない場合 noone (-4) を返す:
- instance_nearest(), instance_furthest()
- instance_place(), instance_position()
- collision_rectangle(), collision_point() など

noone を返された状態でプロパティにアクセスするとエラーになる。`,
    pitfalls: [
      "var _e = instance_nearest(x, y, obj_enemy); _e.hp -= 10; ← _e が noone のときクラッシュ",
      "instance_exists(noone) は false を返すので、instance_exists チェックで安全に確認できる",
      "noone は数値 -4 と等価だが、比較には == noone を使う (可読性のため)",
    ],
    example: `var _nearest = instance_nearest(x, y, obj_enemy);
if (_nearest != noone) {
    _nearest.hp -= 10;
}

// または instance_exists で
if (instance_exists(_nearest)) {
    _nearest.hp -= 10;
}`,
    related: ["instance_nearest", "instance_exists", "instance_place", "instance_find"],
  },

  // ══════════════════════════════════════
  // Object Oriented
  // ══════════════════════════════════════
  {
    name: "継承と event_inherited",
    category: "Object Oriented",
    summary: "子オブジェクトのイベントは親を自動で呼ばない。event_inherited() を明示的に呼ぶ必要がある。",
    details: `GML の継承では、子オブジェクトがイベントをオーバーライドすると親のイベントは実行されない。
親の処理を実行したい場合は event_inherited() を明示的に呼ぶ。
- event_inherited() は親のイベントをそのスコープで実行する
- 複数段の継承でも event_inherited() で1つ上の親だけを呼ぶ
- Draw イベントをオーバーライドすると draw_self() も自動実行されなくなる`,
    pitfalls: [
      "子の Create イベントで event_inherited() を忘れると親の初期化コードが実行されない",
      "子の Draw イベントで event_inherited() または draw_self() を忘れるとスプライトが消える",
      "event_inherited() の呼び出し位置 (前後) によって処理順が変わる",
    ],
    example: `// 子オブジェクトの Create イベント
event_inherited(); // まず親の Create を実行
// 子固有の追加初期化
my_special_var = 42;

// 子の Draw イベント
event_inherited(); // 親のスプライト描画
// 追加の描画処理
draw_circle(x, y, 16, true);`,
    related: ["object_get_parent", "object_is_ancestor"],
  },

  {
    name: "struct とインスタンスの違い",
    category: "Object Oriented",
    summary: "struct はデータのみを持つ軽量オブジェクト。イベントを持たず、GCで管理される。",
    details: `struct はインスタンスと似た「キーと値の集合」だが、根本的に異なる:
- イベント (Step, Draw 等) を持たない
- インスタンスIDを持たない
- ガベージコレクションで自動解放される (instance_destroy 不要)
- new キーワードでコンストラクタから作成できる
- JSON のシリアライズ/デシリアライズに向いている
- typeof(val) で "struct" と判定できる`,
    pitfalls: [
      "struct を with のターゲットにすることはできない (インスタンスではないため)",
      "struct を ds_list や配列に入れると参照渡しになる (コピーではない)",
      "instanceof() で型チェックができるが、コンストラクタ経由で作った場合のみ",
    ],
    example: `// リテラルで作成
var _data = { hp: 100, name: "Player" };
_data.hp -= 10;

// コンストラクタで作成
function Enemy(_type) constructor {
    type = _type;
    hp = 10;
}
var _e = new Enemy(1);
show_debug_message(instanceof(_e)); // "Enemy"`,
    related: ["variable_struct_get", "variable_struct_set", "json_stringify", "instanceof", "typeof"],
  },

  {
    name: "method と関数バインド",
    category: "Object Oriented",
    summary: "method(context, func) で関数を特定インスタンス/structにバインドする。コールバックに渡す際に重要。",
    details: `GML の関数変数はスコープを持たない。method() でコンテキストをバインドすると、
呼び出し時に self が指定したコンテキストになる。
- コールバック (array_map, time_source_create 等) に渡す関数は方要注意
- method を付けないと、コールバック実行時の self が予期しないオブジェクトになる
- method_get_self() でバインド先を確認できる`,
    pitfalls: [
      "array_map(arr, my_func) と書くと my_func 内の self が不定になる",
      "正しくは array_map(arr, method(self, my_func)) とバインドする",
      "call_later のコールバックも同様にバインドが必要",
    ],
    example: `// コールバックに self をバインドする
var _callback = method(self, function() {
    hp -= 1; // self が正しいインスタンスを指す
});
call_later(60, time_source_units_frames, _callback);

// struct にバインド
var _struct = { value: 42 };
var _getter = method(_struct, function() { return value; });
show_debug_message(_getter()); // 42`,
    related: ["method", "method_get_self", "method_get_index", "call_later"],
  },

  // ══════════════════════════════════════
  // Variables
  // ══════════════════════════════════════
  {
    name: "配列の参照渡し",
    category: "Variables",
    summary: "配列は代入時にコピーされる (Copy-on-Write)。ただし関数引数として渡すと参照渡しになる。",
    details: `GML 2.3 以降の配列は Copy-on-Write セマンティクスを持つ:
- var b = a; では最初はコピーを共有し、書き込みが発生した時点でコピーが作られる
- ただし関数やメソッドに引数として渡した場合は参照渡しになる
- array_copy() で明示的にコピーを作れる`,
    pitfalls: [
      "function modify_array(arr) { arr[0] = 99; } を呼ぶと元の配列も変更される",
      "コピーを渡したい場合は array_copy() または array_concat([]) で新しい配列を作る",
      "struct 内の配列プロパティも同じルールが適用される",
    ],
    example: `var _a = [1, 2, 3];
var _b = _a;   // Copy-on-Write: まだ共有
_b[0] = 99;    // 書き込みでコピー発生: _a は変わらない
show_debug_message(_a[0]); // 1 (変わらない)

// 関数引数は参照
function zero_first(arr) { arr[0] = 0; }
zero_first(_a); // _a[0] が 0 になる`,
    related: ["array_copy", "array_create", "is_array"],
  },

  {
    name: "static 変数",
    category: "Variables",
    summary: "static で宣言した変数は関数の全呼び出し間で値を保持する。初期化は初回呼び出し時のみ実行される。",
    details: `static キーワードは関数内で「関数スコープの永続変数」を作る:
- 初回呼び出し時のみ右辺が評価される
- 以降の呼び出しでは既存の値が保持される
- クラスの静的プロパティとしても使える (function 外の static)`,
    pitfalls: [
      "static count = 0; は初回のみ 0 に初期化される。毎回リセットしたい場合は var を使う",
      "static は var と異なりインスタンス間で共有される (クラスの全インスタンスで同じ値)",
    ],
    example: `function get_unique_id() {
    static _counter = 0;
    return ++_counter; // 呼ぶたびに 1, 2, 3, ... と増加
}

// コンストラクタでの static (全インスタンス共有)
function Enemy() constructor {
    static count = 0;
    count++;
    id_num = count;
}`,
    related: ["variable_instance_get", "variable_struct_get"],
  },

  // ══════════════════════════════════════
  // Memory And Performance
  // ══════════════════════════════════════
  {
    name: "DS (データ構造) のメモリ管理",
    category: "Memory And Performance",
    summary: "ds_list, ds_map, ds_grid 等は使い終わったら必ず *_destroy() で解放する。GCの対象外。",
    details: `DS (Data Structure) は GML のガベージコレクタで管理されない。
- 使わなくなったら ds_list_destroy(), ds_map_destroy() 等で手動解放が必須
- ルーム遷移やインスタンス破棄でも自動解放されない
- 特に obj の Create で作成した DS は CleanUp イベントで解放する
- ds_exists(id, type) で有効かチェックできる`,
    pitfalls: [
      "ルーム遷移のたびに ds_list_create() を呼ぶと未解放の DS が蓄積してメモリリークになる",
      "DS を解放した後に参照すると「does not exist」エラー",
      "CleanUp イベント (instance_destroy 時に実行) での解放を忘れがち",
    ],
    example: `// Create イベント
my_list = ds_list_create();

// CleanUp イベント
if (ds_exists(my_list, ds_type_list)) {
    ds_list_destroy(my_list);
}`,
    related: ["ds_list_create", "ds_list_destroy", "ds_exists", "gc_collect"],
  },

  {
    name: "surface のメモリ管理",
    category: "Memory And Performance",
    summary: "surface は一部の端末でリセットされることがある。毎フレーム surface_exists でチェックする必要がある。",
    details: `Surface はグラフィックメモリ上に確保されるため、以下の状況でリセット (消滅) される可能性がある:
- アプリがバックグラウンドに移行した場合 (モバイル)
- グラフィックリセットが発生した場合
- 毎フレームの Draw イベントで surface_exists チェックと再生成が必要`,
    pitfalls: [
      "surface を一度作ったら永遠に使えると思うと、モバイルでクラッシュやブラックアウトが発生する",
      "surface_free() せずに再代入すると古い surface がメモリリークになる",
    ],
    example: `// Draw イベント
if (!surface_exists(my_surface)) {
    my_surface = surface_create(256, 256);
    // surface を再描画する処理
    surface_set_target(my_surface);
    draw_clear(c_black);
    surface_reset_target();
}
draw_surface(my_surface, 0, 0);`,
    related: ["surface_create", "surface_free", "surface_exists", "surface_set_target"],
  },

  // ══════════════════════════════════════
  // Async
  // ══════════════════════════════════════
  {
    name: "非同期イベントの受け取り方",
    category: "Async",
    summary: "http_get 等の非同期処理の結果は Async HTTP イベントで受け取る。戻り値は request_id のみ。",
    details: `非同期処理 (HTTP, ネットワーク, ファイルI/O等) は結果をイベントで受け取る:
- http_get(url) はリクエストIDを返す。結果は Other > Async HTTP イベントで処理する
- Async イベント内では async_load DS map に結果が格納されている
  - async_load[? "id"] : リクエストID (どのリクエストか判別)
  - async_load[? "status"] : ステータス (0=complete, -1=error)
  - async_load[? "result"] : レスポンス文字列
- 同一フレームに複数リクエストが完了した場合、イベントが複数回発火する`,
    pitfalls: [
      "http_get の戻り値 (id) を保存しておかないと、どのリクエストの結果か判別できない",
      "Async HTTP イベントで async_load DS map を destroy してはいけない (自動管理)",
      "ネットワークが遅い/失敗の場合に status が -1 になるエラーハンドリングが必要",
    ],
    example: `// Step or Create
_request_id = http_get("https://api.example.com/data");

// Other > Async HTTP イベント
var _id = async_load[? "id"];
if (_id == _request_id) {
    var _status = async_load[? "status"];
    if (_status == 0) {
        var _data = json_parse(async_load[? "result"]);
        show_debug_message(_data);
    }
}`,
    related: ["http_get", "http_post_string", "http_request", "json_parse"],
  },

  // ══════════════════════════════════════
  // Rendering
  // ══════════════════════════════════════
  {
    name: "Draw GUI とルーム座標の変換",
    category: "Rendering",
    summary: "Draw GUI イベントはカメラに依存しない固定座標系で描画する。ルーム座標に追従させるには変換が必要。",
    details: `Draw イベントはルーム (ワールド) 座標系、Draw GUI イベントは画面固定の GUI 座標系:
- Draw GUI の (0,0) は常に画面左上
- HUD や UI は Draw GUI に書く (カメラが動いても位置が変わらない)
- ゲームオブジェクトの位置に追従する UI (体力バーなど) はルーム座標 → GUI座標に変換が必要`,
    pitfalls: [
      "Draw GUI でルーム座標をそのまま使うと、カメラを動かしたとき UI がズレる",
      "display_get_gui_width/height と view の比率から変換する",
      "Draw イベントと Draw GUI イベントは深度とは独立して分離されている",
    ],
    example: `// Draw GUI で敵の頭上に体力バーを表示
var _cam = view_camera[0];
var _cx = camera_get_view_x(_cam);
var _cy = camera_get_view_y(_cam);
var _cw = camera_get_view_width(_cam);
var _ch = camera_get_view_height(_cam);
var _gw = display_get_gui_width();
var _gh = display_get_gui_height();

with (obj_enemy) {
    var _sx = (x - _cx) / _cw * _gw;
    var _sy = (y - _cy) / _ch * _gh - 20;
    draw_healthbar(_sx - 16, _sy, _sx + 16, _sy + 4, hp / max_hp * 100,
        c_black, c_red, c_lime, 0, true, true);
}`,
    related: ["display_get_gui_width", "display_get_gui_height", "camera_get_view_x", "draw_healthbar"],
  },

  {
    name: "depth と layer の違い",
    category: "Rendering",
    summary: "GMS2 では depth の代わりに layer でオブジェクトの前後関係を管理する。depth は layer 内での順序。",
    details: `GMS2 の描画順序システム:
- Layer: ルームエディタで定義した名前付きの層。深度 (depth) を持つ
- depth: layer 内/インスタンスごとの細かい前後順。数値が大きいほど奥 (後ろ)
- instance_create_layer() でレイヤーを指定、instance_create_depth() で depth を指定
- depth プロパティをスクリプトで変更するとレンダリング順が変わる
- GMS1 の room_depth は廃止`,
    pitfalls: [
      "layer_depth() と instance の depth は別物。layer の depth が大きいほど奥",
      "同一 layer 内では depth の大きいインスタンスが先に (奥に) 描画される",
      "depth = -y; パターン (y座標が大きいほど前に描画) はトップダウンゲームで有用",
    ],
    example: `// トップダウンゲームの深度設定 (Draw イベント or Step)
depth = -y; // y が大きい (画面下) ほど手前に描画される

// layer を名前で指定して生成
var _inst = instance_create_layer(x, y, "Instances", obj_enemy);

// または depth 指定
var _inst = instance_create_depth(x, y, -100, obj_bullet); // 手前`,
    related: ["layer_create", "layer_depth", "layer_get_depth", "instance_create_layer"],
  },

  // ══════════════════════════════════════
  // Room Management
  // ══════════════════════════════════════
  {
    name: "room_goto とインスタンスの破棄",
    category: "Room Management",
    summary: "room_goto() はフレーム末尾で実行される。非 persistent インスタンスは Room End 後に全て破棄される。",
    details: `room_goto() を呼んでも即座にルームが切り替わるわけではない:
- 現在のフレームの処理が全て終わった後にルームが切り替わる
- Room End イベント → 非 persistent インスタンスの CleanUp/Destroy → Room Start イベントの順
- 新ルームの Create イベントは room_goto() と同フレームに実行されない
- game_restart() はゲーム全体をリスタートするため、persistent インスタンスも一旦処理される`,
    pitfalls: [
      "room_goto の直後のコードも実行される (即時終了ではない)",
      "ルーム遷移後に存在しないインスタンスを参照するとエラー",
      "DS やサーフェスは persistent でないインスタンスの CleanUp で確実に解放する",
    ],
    example: `// room_goto の直後のコードも実行される
room_goto(rm_game_over);
show_debug_message("これも実行される"); // 実行される

// Room End イベントでクリーンアップ
// (Other > Room End に書く)
if (ds_exists(my_list, ds_type_list)) {
    ds_list_destroy(my_list);
}`,
    related: ["room_goto", "room_restart", "game_restart", "persistent"],
  },
];

// ─── Concept search helpers ───

export function searchConcepts(query: string, category?: string): GmlConcept[] {
  const keywords = query.toLowerCase().split(/\s+/).filter(k => k.length > 0);
  if (keywords.length === 0) return [];

  interface Scored { concept: GmlConcept; score: number }
  const results: Scored[] = [];

  for (const c of GML_CONCEPTS) {
    if (category && c.category !== category) continue;
    let score = 0;
    const nameLower    = c.name.toLowerCase();
    const summaryLower = c.summary.toLowerCase();
    const detailsLower = c.details.toLowerCase();
    const catLower     = c.category.toLowerCase();
    const pitfallText  = c.pitfalls.join(" ").toLowerCase();

    for (const kw of keywords) {
      if (nameLower.includes(kw))    score += 4;
      if (summaryLower.includes(kw)) score += 2;
      if (detailsLower.includes(kw)) score += 1;
      if (catLower.includes(kw))     score += 1;
      if (pitfallText.includes(kw))  score += 1.5;
    }
    if (score > 0) results.push({ concept: c, score });
  }

  results.sort((a, b) => b.score - a.score);
  return results.map(r => r.concept);
}

export function lookupConcept(name: string): GmlConcept | undefined {
  const q = name.toLowerCase();
  return GML_CONCEPTS.find(c => c.name.toLowerCase().includes(q));
}
