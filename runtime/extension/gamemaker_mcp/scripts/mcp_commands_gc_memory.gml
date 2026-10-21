/// @description MCP Commands - GC/Memory Tools

function mcp_register_commands_gc_memory() {

    mcp_route("gc_collect", function(_params) {
        gc_collect();
        return {
            collected: true,
            time: current_time
        };
    });

    mcp_route("gc_get_stats", function(_params) {
        var _stats = gc_get_stats();
        return _stats;
    });

    mcp_route("gc_set_target_frame_time", function(_params) {
        if (!variable_struct_exists(_params, "target_time")) {
            return { __error: "Missing required parameter: target_time", __code: -32602 };
        }

        gc_target_frame_time(_params.target_time);
        return {
            target_time: _params.target_time,
            success: true
        };
    });

    mcp_route("get_surface_memory", function(_params) {
        var _total = 0;
        var _surfaces = [];

        if (surface_exists(application_surface)) {
            var _w = surface_get_width(application_surface);
            var _h = surface_get_height(application_surface);
            var _bytes = _w * _h * 4;
            _total += _bytes;
            array_push(_surfaces, {
                name: "application_surface",
                width: _w,
                height: _h,
                estimated_bytes: _bytes
            });
        }

        return {
            estimated_bytes: _total,
            surfaces: _surfaces
        };
    });

    mcp_route("get_ds_memory_estimate", function(_params) {
        return {
            note: "DS memory estimation not directly available in GML",
            instance_count: instance_count,
            global_struct_count: variable_struct_names_count(global)
        };
    });

    mcp_route("get_memory_snapshot", function(_params) {
        var _w = surface_get_width(application_surface);
        var _h = surface_get_height(application_surface);

        return {
            gc_stats: gc_get_stats(),
            fps: fps,
            fps_real: fps_real,
            instance_count: instance_count,
            time: current_time,
            application_surface: {
                width: _w,
                height: _h,
                estimated_bytes: _w * _h * 4
            }
        };
    });

}
