<?php
/**
 * Plugin Name:       SaPyBase AI Chatbot
 * Plugin URI:        https://www.sapybase.com
 * Description:       Embed your SaPyBase AI chatbot on any WordPress site. Paste your Bot ID from the SaPyBase dashboard and you're live.
 * Version:           1.0.0
 * Requires at least: 5.9
 * Requires PHP:      7.4
 * Author:            SaPyBase
 * Author URI:        https://www.sapybase.com
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       sapybase-chatbot
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

// ── Settings ─────────────────────────────────────────────────────────────────

add_action( 'admin_menu', 'sapybase_admin_menu' );
function sapybase_admin_menu() {
    add_options_page(
        'SaPyBase Chatbot',
        'SaPyBase Chatbot',
        'manage_options',
        'sapybase-chatbot',
        'sapybase_settings_page'
    );
}

add_action( 'admin_init', 'sapybase_register_settings' );
function sapybase_register_settings() {
    register_setting( 'sapybase_options', 'sapybase_bot_id',       [ 'sanitize_callback' => 'sanitize_text_field' ] );
    register_setting( 'sapybase_options', 'sapybase_position',     [ 'sanitize_callback' => 'sanitize_text_field', 'default' => 'bottom-right' ] );
    register_setting( 'sapybase_options', 'sapybase_theme_color',  [ 'sanitize_callback' => 'sanitize_hex_color',  'default' => '#5730F5' ] );
    register_setting( 'sapybase_options', 'sapybase_enabled',      [ 'sanitize_callback' => 'absint',              'default' => 1 ] );
}

function sapybase_settings_page() {
    if ( ! current_user_can( 'manage_options' ) ) return;
    $bot_id      = get_option( 'sapybase_bot_id', '' );
    $position    = get_option( 'sapybase_position', 'bottom-right' );
    $theme_color = get_option( 'sapybase_theme_color', '#5730F5' );
    $enabled     = get_option( 'sapybase_enabled', 1 );
    ?>
    <div class="wrap">
        <h1><?php esc_html_e( 'SaPyBase AI Chatbot', 'sapybase-chatbot' ); ?></h1>
        <?php if ( empty( $bot_id ) ) : ?>
            <div class="notice notice-warning"><p>
                <?php esc_html_e( 'Enter your Bot ID below. Find it in the SaPyBase dashboard under Settings → API Keys.', 'sapybase-chatbot' ); ?>
            </p></div>
        <?php endif; ?>
        <form method="post" action="options.php">
            <?php settings_fields( 'sapybase_options' ); ?>
            <table class="form-table" role="presentation">
                <tr>
                    <th scope="row"><label for="sapybase_bot_id"><?php esc_html_e( 'Bot ID', 'sapybase-chatbot' ); ?></label></th>
                    <td>
                        <input type="text" id="sapybase_bot_id" name="sapybase_bot_id"
                            value="<?php echo esc_attr( $bot_id ); ?>"
                            class="regular-text" placeholder="e.g. e70a4307-ef55-47e1-a67f-638327..." />
                        <p class="description"><?php esc_html_e( 'The UUID shown in your SaPyBase dashboard for this bot.', 'sapybase-chatbot' ); ?></p>
                    </td>
                </tr>
                <tr>
                    <th scope="row"><label for="sapybase_position"><?php esc_html_e( 'Position', 'sapybase-chatbot' ); ?></label></th>
                    <td>
                        <select id="sapybase_position" name="sapybase_position">
                            <option value="bottom-right" <?php selected( $position, 'bottom-right' ); ?>><?php esc_html_e( 'Bottom Right', 'sapybase-chatbot' ); ?></option>
                            <option value="bottom-left"  <?php selected( $position, 'bottom-left' );  ?>><?php esc_html_e( 'Bottom Left',  'sapybase-chatbot' ); ?></option>
                        </select>
                    </td>
                </tr>
                <tr>
                    <th scope="row"><label for="sapybase_theme_color"><?php esc_html_e( 'Theme Color', 'sapybase-chatbot' ); ?></label></th>
                    <td>
                        <input type="color" id="sapybase_theme_color" name="sapybase_theme_color"
                            value="<?php echo esc_attr( $theme_color ); ?>" />
                    </td>
                </tr>
                <tr>
                    <th scope="row"><?php esc_html_e( 'Enable Widget', 'sapybase-chatbot' ); ?></th>
                    <td>
                        <label>
                            <input type="checkbox" name="sapybase_enabled" value="1" <?php checked( $enabled, 1 ); ?> />
                            <?php esc_html_e( 'Show chatbot on all pages', 'sapybase-chatbot' ); ?>
                        </label>
                    </td>
                </tr>
            </table>
            <?php submit_button(); ?>
        </form>
    </div>
    <?php
}

// ── Frontend embed ────────────────────────────────────────────────────────────

add_action( 'wp_footer', 'sapybase_embed_widget' );
function sapybase_embed_widget() {
    if ( ! get_option( 'sapybase_enabled', 1 ) ) return;

    $bot_id = get_option( 'sapybase_bot_id', '' );
    if ( empty( $bot_id ) ) return;

    // Validate: must look like a UUID or alphanumeric slug — never echo raw option value
    if ( ! preg_match( '/^[a-zA-Z0-9_\-]{8,64}$/', $bot_id ) ) return;

    $position    = get_option( 'sapybase_position', 'bottom-right' );
    $theme_color = get_option( 'sapybase_theme_color', '#5730F5' );

    // Whitelist position values
    if ( ! in_array( $position, [ 'bottom-right', 'bottom-left' ], true ) ) {
        $position = 'bottom-right';
    }

    // SaPyBaseConfig lets the loader pick up theme color without an extra attribute
    ?>
    <script>
    window.SaPyBaseConfig = { themeColor: <?php echo wp_json_encode( $theme_color ); ?> };
    </script>
    <script
        src="https://www.sapybase.com/sapybase-loader.js"
        data-bot-id="<?php echo esc_attr( $bot_id ); ?>"
        data-position="<?php echo esc_attr( $position ); ?>"
        defer
    ></script>
    <?php
}
