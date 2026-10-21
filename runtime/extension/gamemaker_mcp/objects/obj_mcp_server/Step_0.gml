/// @description MCP Server Step
if (!MCP_ENABLED) exit;

// Handle game pause
if (global.__mcp_paused) {
    // When paused, we still need networking to work
    // GameMaker's Async events still fire even when we deactivate instances
}

// Handle camera shake
if (global.__mcp_camera_shake.active) {
    var _shake = global.__mcp_camera_shake;
    _shake.duration--;
    if (_shake.duration <= 0) {
        _shake.active = false;
        _shake.offset_x = 0;
        _shake.offset_y = 0;
    } else {
        _shake.offset_x = irandom_range(-_shake.intensity, _shake.intensity);
        _shake.offset_y = irandom_range(-_shake.intensity, _shake.intensity);
    }

    // Apply shake to active camera
    var _cam = camera_get_active();
    if (_cam >= 0) {
        var _cx = camera_get_view_x(_cam);
        var _cy = camera_get_view_y(_cam);
        camera_set_view_pos(_cam, _cx + _shake.offset_x, _cy + _shake.offset_y);
    }
}

// Handle profiling
if (global.__mcp_profiling) {
    global.__mcp_profiling_frame++;
    var _frame_data = {
        frame: global.__mcp_profiling_frame,
        fps: fps,
        fps_real: fps_real,
        instance_count: instance_count,
        step_time: -1 // filled by draw event timing if available
    };
    variable_struct_set(global.__mcp_profiling_data, string(global.__mcp_profiling_frame), _frame_data);
}

// Handle watched variables
var _watches = global.__mcp_watched_variables;
for (var _i = 0; _i < array_length(_watches); _i++) {
    var _w = _watches[_i];
    if (instance_exists(_w.instance_id)) {
        var _val = variable_instance_get(_w.instance_id, _w.variable);
        if (_val != _w.last_value) {
            mcp_log("Watch: " + _w.variable + " changed from " + string(_w.last_value) + " to " + string(_val));
            _w.last_value = _val;
        }
    }
}

// Handle recording
if (global.__mcp_recording) {
    // Recording is handled in Draw GUI End
}

// Handle variable history tracking
if (global.__mcp_variable_tracking_enabled) {
    var _tracked = variable_struct_get_names(global.__mcp_variable_history);
    for (var _t = 0; _t < array_length(_tracked); _t++) {
        var _key = _tracked[_t];
        var _entry = global.__mcp_variable_history[$ _key];
        if (instance_exists(_entry.instance_id)) {
            var _val = variable_instance_get(_entry.instance_id, _entry.variable);
            if (_val != _entry.last_value) {
                _entry.change_count++;
                _entry.last_value = _val;
            }
            array_push(_entry.history, { value: _val, frame: _entry.frame_count, time: current_time });
            _entry.frame_count++;
            // Cap history at max_samples
            if (array_length(_entry.history) > _entry.max_samples) {
                array_delete(_entry.history, 0, 1);
            }
        }
    }
}
