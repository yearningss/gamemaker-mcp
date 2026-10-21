/// @description MCP Commands - Skeleton/Spine Animation

function mcp_register_commands_skeleton() {

    mcp_route("get_skeleton_info", function(_params) {
        if (!variable_struct_exists(_params, "instance_id")) {
            return { __error: "Missing required parameter: instance_id", __code: -32602 };
        }

        var _inst = _params.instance_id;
        if (!instance_exists(_inst)) {
            return { __error: "Instance does not exist: " + string(_inst), __code: -32602 };
        }

        try {
            with (_inst) {
                return {
                    instance_id: id,
                    sprite_name: sprite_get_name(sprite_index),
                    has_skeleton: true,
                    animation: skeleton_animation_get(),
                    skin: skeleton_skin_get()
                };
            }
        } catch(_e) {
            return {
                instance_id: _inst,
                has_skeleton: false,
                error: "No skeleton/Spine data"
            };
        }
    });

    mcp_route("get_skeleton_animations", function(_params) {
        if (!variable_struct_exists(_params, "instance_id")) {
            return { __error: "Missing required parameter: instance_id", __code: -32602 };
        }

        var _inst = _params.instance_id;
        if (!instance_exists(_inst)) {
            return { __error: "Instance does not exist: " + string(_inst), __code: -32602 };
        }

        try {
            with (_inst) {
                var _list = ds_list_create();
                skeleton_animation_list(sprite_index, _list);
                var _arr = [];
                for (var _i = 0; _i < ds_list_size(_list); _i++) {
                    array_push(_arr, _list[| _i]);
                }
                ds_list_destroy(_list);
                return {
                    instance_id: id,
                    animations: _arr,
                    count: array_length(_arr)
                };
            }
        } catch(_e) {
            return { __error: "Spine not available: " + string(_e), __code: -32603 };
        }
    });

    mcp_route("get_skeleton_skins", function(_params) {
        if (!variable_struct_exists(_params, "instance_id")) {
            return { __error: "Missing required parameter: instance_id", __code: -32602 };
        }

        var _inst = _params.instance_id;
        if (!instance_exists(_inst)) {
            return { __error: "Instance does not exist: " + string(_inst), __code: -32602 };
        }

        try {
            with (_inst) {
                var _list = ds_list_create();
                skeleton_skin_list(sprite_index, _list);
                var _arr = [];
                for (var _i = 0; _i < ds_list_size(_list); _i++) {
                    array_push(_arr, _list[| _i]);
                }
                ds_list_destroy(_list);
                return {
                    instance_id: id,
                    skins: _arr,
                    count: array_length(_arr)
                };
            }
        } catch(_e) {
            return { __error: "Spine not available: " + string(_e), __code: -32603 };
        }
    });

    mcp_route("get_skeleton_slots", function(_params) {
        if (!variable_struct_exists(_params, "instance_id")) {
            return { __error: "Missing required parameter: instance_id", __code: -32602 };
        }

        var _inst = _params.instance_id;
        if (!instance_exists(_inst)) {
            return { __error: "Instance does not exist: " + string(_inst), __code: -32602 };
        }

        try {
            with (_inst) {
                var _list = ds_list_create();
                skeleton_slot_data(sprite_index, _list);
                var _arr = [];
                for (var _i = 0; _i < ds_list_size(_list); _i++) {
                    array_push(_arr, _list[| _i]);
                }
                ds_list_destroy(_list);
                return {
                    instance_id: id,
                    slots: _arr,
                    count: array_length(_arr)
                };
            }
        } catch(_e) {
            return { __error: "Spine not available: " + string(_e), __code: -32603 };
        }
    });

    mcp_route("set_skeleton_animation", function(_params) {
        if (!variable_struct_exists(_params, "instance_id")) {
            return { __error: "Missing required parameter: instance_id", __code: -32602 };
        }
        if (!variable_struct_exists(_params, "animation")) {
            return { __error: "Missing required parameter: animation", __code: -32602 };
        }

        var _inst = _params.instance_id;
        if (!instance_exists(_inst)) {
            return { __error: "Instance does not exist: " + string(_inst), __code: -32602 };
        }

        var _animation = _params.animation;

        try {
            with (_inst) {
                skeleton_animation_set(_animation);
            }
            return {
                instance_id: _inst,
                animation: _animation,
                success: true
            };
        } catch(_e) {
            return { __error: "Failed to set skeleton animation: " + string(_e), __code: -32603 };
        }
    });

    mcp_route("set_skeleton_skin", function(_params) {
        if (!variable_struct_exists(_params, "instance_id")) {
            return { __error: "Missing required parameter: instance_id", __code: -32602 };
        }
        if (!variable_struct_exists(_params, "skin")) {
            return { __error: "Missing required parameter: skin", __code: -32602 };
        }

        var _inst = _params.instance_id;
        if (!instance_exists(_inst)) {
            return { __error: "Instance does not exist: " + string(_inst), __code: -32602 };
        }

        var _skin = _params.skin;

        try {
            with (_inst) {
                skeleton_skin_set(_skin);
            }
            return {
                instance_id: _inst,
                skin: _skin,
                success: true
            };
        } catch(_e) {
            return { __error: "Failed to set skeleton skin: " + string(_e), __code: -32603 };
        }
    });
}
