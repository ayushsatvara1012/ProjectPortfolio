<?php
/**
 * Plugin Name:       Sapybase AI Chatbot
 * Plugin URI:        https://www.Sapybase.com
 * Description:       Embed your Sapybase AI chatbot on any WordPress site. Paste your Bot ID from the Sapybase dashboard and you're live.
 * Version:           1.0.0
 * Requires at least: 5.9
 * Requires PHP:      7.4
 * Author:            Sapybase
 * Author URI:        https://www.Sapybase.com
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       Sapybase-chatbot
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

// ── Settings ─────────────────────────────────────────────────────────────────

add_action( 'admin_menu', 'Sapybase_admin_menu' );
function Sapybase_admin_menu() {
    add_options_page(
        'Sapybase Chatbot',
        'Sapybase Chatbot',
        'manage_options',
        'Sapybase-chatbot',
        'Sapybase_settings_page'
    );
}

add_action( 'admin_init', 'Sapybase_register_settings' );
function Sapybase_register_settings() {
    register_setting( 'Sapybase_options', 'Sapybase_bot_id',       [ 'sanitize_callback' => 'sanitize_text_field' ] );
    register_setting( 'Sapybase_options', 'Sapybase_position',     [ 'sanitize_callback' => 'sanitize_text_field', 'default' => 'bottom-right' ] );
    register_setting( 'Sapybase_options', 'Sapybase_theme_color',  [ 'sanitize_callback' => 'sanitize_hex_color',  'default' => '#5730F5' ] );
    register_setting( 'Sapybase_options', 'Sapybase_enabled',      [ 'sanitize_callback' => 'absint',              'default' => 1 ] );
}

function Sapybase_settings_page() {
    if ( ! current_user_can( 'manage_options' ) ) return;
    $bot_id      = get_option( 'Sapybase_bot_id', '' );
    $position    = get_option( 'Sapybase_position', 'bottom-right' );
    $theme_color = get_option( 'Sapybase_theme_color', '#5730F5' );
    $enabled     = get_option( 'Sapybase_enabled', 1 );
    ?>
    <div class="wrap">
        <h1><?php esc_html_e( 'Sapybase AI Chatbot', 'Sapybase-chatbot' ); ?></h1>
        <?php if ( empty( $bot_id ) ) : ?>
            <div class="notice notice-warning"><p>
                <?php esc_html_e( 'Enter your Bot ID below. Find it in the Sapybase dashboard under Settings → API Keys.', 'Sapybase-chatbot' ); ?>
            </p></div>
        <?php endif; ?>
        <form method="post" action="options.php">
            <?php settings_fields( 'Sapybase_options' ); ?>
            <table class="form-table" role="presentation">
                <tr>
                    <th scope="row"><label for="Sapybase_bot_id"><?php esc_html_e( 'Bot ID', 'Sapybase-chatbot' ); ?></label></th>
                    <td>
                        <input type="text" id="Sapybase_bot_id" name="Sapybase_bot_id"
                            value="<?php echo esc_attr( $bot_id ); ?>"
                            class="regular-text" placeholder="e.g. e70a4307-ef55-47e1-a67f-638327..." />
                        <p class="description"><?php esc_html_e( 'The UUID shown in your Sapybase dashboard for this bot.', 'Sapybase-chatbot' ); ?></p>
                    </td>
                </tr>
                <tr>
                    <th scope="row"><label for="Sapybase_position"><?php esc_html_e( 'Position', 'Sapybase-chatbot' ); ?></label></th>
                    <td>
                        <select id="Sapybase_position" name="Sapybase_position">
                            <option value="bottom-right" <?php selected( $position, 'bottom-right' ); ?>><?php esc_html_e( 'Bottom Right', 'Sapybase-chatbot' ); ?></option>
                            <option value="bottom-left"  <?php selected( $position, 'bottom-left' );  ?>><?php esc_html_e( 'Bottom Left',  'Sapybase-chatbot' ); ?></option>
                        </select>
                    </td>
                </tr>
                <tr>
                    <th scope="row"><label for="Sapybase_theme_color"><?php esc_html_e( 'Theme Color', 'Sapybase-chatbot' ); ?></label></th>
                    <td>
                        <input type="color" id="Sapybase_theme_color" name="Sapybase_theme_color"
                            value="<?php echo esc_attr( $theme_color ); ?>" />
                    </td>
                </tr>
                <tr>
                    <th scope="row"><?php esc_html_e( 'Enable Widget', 'Sapybase-chatbot' ); ?></th>
                    <td>
                        <label>
                            <input type="checkbox" name="Sapybase_enabled" value="1" <?php checked( $enabled, 1 ); ?> />
                            <?php esc_html_e( 'Show chatbot on all pages', 'Sapybase-chatbot' ); ?>
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

add_action( 'wp_footer', 'Sapybase_embed_widget' );
function Sapybase_embed_widget() {
    if ( ! get_option( 'Sapybase_enabled', 1 ) ) return;

    $bot_id = get_option( 'Sapybase_bot_id', '' );
    if ( empty( $bot_id ) ) return;

    // Validate: must look like a UUID or alphanumeric slug — never echo raw option value
    if ( ! preg_match( '/^[a-zA-Z0-9_\-]{8,64}$/', $bot_id ) ) return;

    $position    = get_option( 'Sapybase_position', 'bottom-right' );
    $theme_color = get_option( 'Sapybase_theme_color', '#5730F5' );

    // Whitelist position values
    if ( ! in_array( $position, [ 'bottom-right', 'bottom-left' ], true ) ) {
        $position = 'bottom-right';
    }

    // SapybaseConfig lets the loader pick up theme color without an extra attribute
    ?>
    <script>
    window.SapybaseConfig = { themeColor: <?php echo wp_json_encode( $theme_color ); ?> };
    </script>
    <script
        src="https://www.sapybase.com/sapybase-loader.js"
        data-bot-id="<?php echo esc_attr( $bot_id ); ?>"
        data-position="<?php echo esc_attr( $position ); ?>"
        defer
    ></script>
    <?php
}
