<?php
/**
 * Plugin Name: Verdia AI Chatbot Widget
 * Description: White-label, AI-powered live chat widget integration. Seamlessly embeds the chatbot on your site.
 * Version: 1.0.0
 * Author: Verdia AI
 * License: GPL2
 */

// Exit if accessed directly
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

// Hook to add administration menu items
add_action( 'admin_menu', 'verdia_chatbot_add_admin_menu' );
add_action( 'admin_init', 'verdia_chatbot_settings_init' );

// Enqueue the universal widget script on public-facing site pages
add_action( 'wp_footer', 'verdia_chatbot_enqueue_widget' );

function verdia_chatbot_add_admin_menu() {
    add_options_page(
        'AI Chatbot Settings', // Page title
        'AI Chatbot',          // Menu title
        'manage_options',      // Capability
        'verdia_chatbot',      // Menu slug
        'verdia_chatbot_options_page' // Callback
    );
}

function verdia_chatbot_settings_init() {
    register_setting( 'verdiaChatbotPlugin', 'verdia_chatbot_settings' );

    add_settings_section(
        'verdia_chatbot_pluginPage_section',
        __( 'Chatbot Settings', 'wordpress' ),
        'verdia_chatbot_settings_section_callback',
        'verdiaChatbotPlugin'
    );

    add_settings_field(
        'api_key',
        __( 'API Key', 'wordpress' ),
        'verdia_chatbot_api_key_render',
        'verdiaChatbotPlugin',
        'verdia_chatbot_pluginPage_section'
    );

    add_settings_field(
        'api_host',
        __( 'API Host Server', 'wordpress' ),
        'verdia_chatbot_api_host_render',
        'verdiaChatbotPlugin',
        'verdia_chatbot_pluginPage_section'
    );
}

function verdia_chatbot_settings_section_callback() {
    echo __( 'Configure your Verdia AI chatbot settings below. You can find your API key inside the SaaS Admin Dashboard.', 'wordpress' );
}

function verdia_chatbot_api_key_render() {
    $options = get_option( 'verdia_chatbot_settings' );
    $val = isset( $options['api_key'] ) ? esc_attr( $options['api_key'] ) : '';
    echo '<input type="password" name="verdia_chatbot_settings[api_key]" value="' . $val . '" style="width: 350px;" placeholder="sk_live_...">';
}

function verdia_chatbot_api_host_render() {
    $options = get_option( 'verdia_chatbot_settings' );
    $val = isset( $options['api_host'] ) ? esc_url( $options['api_host'] ) : 'http://localhost:8000';
    echo '<input type="text" name="verdia_chatbot_settings[api_host]" value="' . $val . '" style="width: 350px;" placeholder="http://localhost:8000">';
    echo '<p class="description">URL endpoint of your running FastAPI AI backend server.</p>';
}

function verdia_chatbot_options_page() {
    ?>
    <div class="wrap" style="max-width: 600px; background: #fff; padding: 24px; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.05); margin-top: 24px;">
        <h2 style="border-bottom: 1.5px solid #F3F4F6; padding-bottom: 12px; margin-bottom: 20px;">Verdia AI Chatbot Widget Configuration</h2>
        <form action='options.php' method='post'>
            <?php
            settings_fields( 'verdiaChatbotPlugin' );
            do_settings_sections( 'verdiaChatbotPlugin' );
            submit_button( 'Save Chatbot Config' );
            ?>
        </form>
    </div>
    <?php
}

function verdia_chatbot_enqueue_widget() {
    $options = get_option( 'verdia_chatbot_settings' );
    
    $api_key = isset( $options['api_key'] ) ? trim( $options['api_key'] ) : '';
    $api_host = isset( $options['api_host'] ) ? esc_url( trim( $options['api_host'] ) ) : 'http://localhost:8000';

    if ( empty( $api_key ) ) {
        return; // Do not render if API Key is not set yet
    }
    
    // Inject configurations on client window and append the universal JS script widget
    ?>
    <!-- Verdia AI Chatbot Widget -->
    <script type="text/javascript">
        window.ChatbotConfig = {
            apiKey: '<?php echo esc_js( $api_key ); ?>',
            apiHost: '<?php echo esc_js( $api_host ); ?>'
        };
    </script>
    <script src="<?php echo esc_url( $api_host ); ?>/widget.js" defer></script>
    <?php
}
