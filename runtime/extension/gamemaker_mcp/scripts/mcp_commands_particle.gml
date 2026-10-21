/// @description MCP Commands - Particle Systems

function mcp_register_commands_particle() {

    mcp_route("get_particle_systems", function(_params) {
        // GameMaker does not provide a built-in function to list all particle systems.
        // We track created systems in a global array.
        if (!variable_global_exists("__mcp_particle_systems")) {
            global.__mcp_particle_systems = [];
        }

        var _systems = [];
        for (var _i = 0; _i < array_length(global.__mcp_particle_systems); _i++) {
            var _sys = global.__mcp_particle_systems[_i];
            if (part_system_exists(_sys.id)) {
                array_push(_systems, {
                    system_id: _sys.id,
                    label: _sys.label,
                    particle_count: part_particles_count(_sys.id)
                });
            }
        }

        return {
            systems: _systems,
            count: array_length(_systems),
            note: "Only tracks particle systems created through MCP commands."
        };
    });

    mcp_route("create_particle_system", function(_params) {
        // Bridge sends "layer_name", accept both "layer_name" and "layer"
        if (!variable_struct_exists(_params, "layer_name") && !variable_struct_exists(_params, "layer")) {
            return { __error: "Missing required parameter: layer_name", __code: -32602 };
        }

        var _layer_val = variable_struct_exists(_params, "layer_name") ? _params.layer_name : _params.layer;
        var _layer_id;
        if (is_string(_layer_val)) {
            _layer_id = layer_get_id(_layer_val);
            if (_layer_id < 0) {
                return { __error: "Layer not found: " + _layer_val, __code: -32602 };
            }
        } else {
            _layer_id = _layer_val;
        }

        var _persistent = variable_struct_exists(_params, "persistent") ? _params.persistent : false;
        var _sys = part_system_create_layer(_layer_id, _persistent);

        if (!variable_global_exists("__mcp_particle_systems")) {
            global.__mcp_particle_systems = [];
        }

        var _label = variable_struct_exists(_params, "label") ? _params.label : ("system_" + string(array_length(global.__mcp_particle_systems)));
        array_push(global.__mcp_particle_systems, { id: _sys, label: _label });

        return {
            system_id: _sys,
            label: _label,
            persistent: _persistent,
            success: true
        };
    });

    mcp_route("create_particle_type", function(_params) {
        var _pt = part_type_create();

        // Shape
        if (variable_struct_exists(_params, "shape")) {
            var _shape_map = ds_map_create();
            ds_map_add(_shape_map, "pixel", pt_shape_pixel);
            ds_map_add(_shape_map, "disk", pt_shape_disk);
            ds_map_add(_shape_map, "square", pt_shape_square);
            ds_map_add(_shape_map, "line", pt_shape_line);
            ds_map_add(_shape_map, "star", pt_shape_star);
            ds_map_add(_shape_map, "circle", pt_shape_circle);
            ds_map_add(_shape_map, "ring", pt_shape_ring);
            ds_map_add(_shape_map, "sphere", pt_shape_sphere);
            ds_map_add(_shape_map, "flare", pt_shape_flare);
            ds_map_add(_shape_map, "spark", pt_shape_spark);
            ds_map_add(_shape_map, "explosion", pt_shape_explosion);
            ds_map_add(_shape_map, "cloud", pt_shape_cloud);
            ds_map_add(_shape_map, "smoke", pt_shape_smoke);
            ds_map_add(_shape_map, "snow", pt_shape_snow);

            var _shape_val = ds_map_find_value(_shape_map, _params.shape);
            if (!is_undefined(_shape_val)) {
                part_type_shape(_pt, _shape_val);
            }
            ds_map_destroy(_shape_map);
        }

        // Colour
        if (variable_struct_exists(_params, "color1") && variable_struct_exists(_params, "color2")) {
            part_type_colour2(_pt, _params.color1, _params.color2);
        } else if (variable_struct_exists(_params, "color1")) {
            part_type_colour1(_pt, _params.color1);
        }

        // Alpha - bridge sends alpha1/alpha2, accept both
        var _alpha_start = 1;
        if (variable_struct_exists(_params, "alpha1")) _alpha_start = _params.alpha1;
        else if (variable_struct_exists(_params, "alpha_start")) _alpha_start = _params.alpha_start;
        var _alpha_end = 0;
        if (variable_struct_exists(_params, "alpha2")) _alpha_end = _params.alpha2;
        else if (variable_struct_exists(_params, "alpha_end")) _alpha_end = _params.alpha_end;
        part_type_alpha2(_pt, _alpha_start, _alpha_end);

        // Size
        var _size_min = variable_struct_exists(_params, "size_min") ? _params.size_min : 1;
        var _size_max = variable_struct_exists(_params, "size_max") ? _params.size_max : 1;
        var _size_incr = variable_struct_exists(_params, "size_incr") ? _params.size_incr : 0;
        var _size_wiggle = variable_struct_exists(_params, "size_wiggle") ? _params.size_wiggle : 0;
        part_type_size(_pt, _size_min, _size_max, _size_incr, _size_wiggle);

        // Life
        var _life_min = variable_struct_exists(_params, "life_min") ? _params.life_min : 30;
        var _life_max = variable_struct_exists(_params, "life_max") ? _params.life_max : 60;
        part_type_life(_pt, _life_min, _life_max);

        // Speed
        var _speed_min = variable_struct_exists(_params, "speed_min") ? _params.speed_min : 1;
        var _speed_max = variable_struct_exists(_params, "speed_max") ? _params.speed_max : 3;
        var _speed_incr = variable_struct_exists(_params, "speed_incr") ? _params.speed_incr : 0;
        var _speed_wiggle = variable_struct_exists(_params, "speed_wiggle") ? _params.speed_wiggle : 0;
        part_type_speed(_pt, _speed_min, _speed_max, _speed_incr, _speed_wiggle);

        // Direction - bridge sends direction_min/direction_max, accept both
        var _dir_min = 0;
        if (variable_struct_exists(_params, "direction_min")) _dir_min = _params.direction_min;
        else if (variable_struct_exists(_params, "dir_min")) _dir_min = _params.dir_min;
        var _dir_max = 360;
        if (variable_struct_exists(_params, "direction_max")) _dir_max = _params.direction_max;
        else if (variable_struct_exists(_params, "dir_max")) _dir_max = _params.dir_max;
        var _dir_incr = variable_struct_exists(_params, "dir_incr") ? _params.dir_incr : 0;
        var _dir_wiggle = variable_struct_exists(_params, "dir_wiggle") ? _params.dir_wiggle : 0;
        part_type_direction(_pt, _dir_min, _dir_max, _dir_incr, _dir_wiggle);

        // Gravity
        var _grav_amount = variable_struct_exists(_params, "gravity_amount") ? _params.gravity_amount : 0;
        var _grav_dir = variable_struct_exists(_params, "gravity_direction") ? _params.gravity_direction : 270;
        part_type_gravity(_pt, _grav_amount, _grav_dir);

        return {
            particle_type_id: _pt,
            success: true
        };
    });

    mcp_route("emit_particles", function(_params) {
        if (!variable_struct_exists(_params, "system_id")) {
            return { __error: "Missing required parameter: system_id", __code: -32602 };
        }
        if (!variable_struct_exists(_params, "x") || !variable_struct_exists(_params, "y")) {
            return { __error: "Missing required parameters: x, y", __code: -32602 };
        }
        if (!variable_struct_exists(_params, "type_id")) {
            return { __error: "Missing required parameter: type_id", __code: -32602 };
        }

        var _count = variable_struct_exists(_params, "count") ? _params.count : 10;

        if (!part_system_exists(_params.system_id)) {
            return { __error: "Particle system does not exist: " + string(_params.system_id), __code: -32602 };
        }

        part_particles_create(_params.system_id, _params.x, _params.y, _params.type_id, _count);

        return {
            system_id: _params.system_id,
            x: _params.x,
            y: _params.y,
            type_id: _params.type_id,
            count: _count,
            success: true
        };
    });

    mcp_route("get_particle_count", function(_params) {
        if (!variable_struct_exists(_params, "system_id")) {
            return { __error: "Missing required parameter: system_id", __code: -32602 };
        }

        if (!part_system_exists(_params.system_id)) {
            return { __error: "Particle system does not exist: " + string(_params.system_id), __code: -32602 };
        }

        return {
            system_id: _params.system_id,
            count: part_particles_count(_params.system_id)
        };
    });

    mcp_route("clear_particles", function(_params) {
        if (!variable_struct_exists(_params, "system_id")) {
            return { __error: "Missing required parameter: system_id", __code: -32602 };
        }

        if (!part_system_exists(_params.system_id)) {
            return { __error: "Particle system does not exist: " + string(_params.system_id), __code: -32602 };
        }

        part_particles_clear(_params.system_id);

        return {
            system_id: _params.system_id,
            cleared: true,
            success: true
        };
    });
}
