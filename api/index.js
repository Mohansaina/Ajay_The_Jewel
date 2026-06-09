const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;
const HOST = '127.0.0.1'; // Compliance: Listen on localhost for testing

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Basic memory rate limiter
const ipRequestCounts = new Map();
setInterval(() => ipRequestCounts.clear(), 60000); // Reset count every minute

app.use((req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const current = ipRequestCounts.get(ip) || 0;
    if (current >= 100) {
        return res.status(429).json({ error: 'Too many requests from this IP. Please try again in a minute.' });
    }
    ipRequestCounts.set(ip, current + 1);
    next();
});

// Security headers middleware
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Content-Security-Policy', "default-src 'self' https://cdn.tailwindcss.com https://fonts.googleapis.com https://fonts.gstatic.com; style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://fonts.googleapis.com; script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https://lh3.googleusercontent.com; connect-src 'self';");
    next();
});

// Initialize JSON-based database (use /tmp on Vercel for writable ephemeral storage)
const isVercel = process.env.VERCEL === '1' || process.env.NOW_BUILDER === '1';
const dbPath = isVercel ? path.join('/tmp', 'ajay_jeweller.json') : path.join(__dirname, '..', 'ajay_jeweller.json');

function loadDb() {
    try {
        if (fs.existsSync(dbPath)) {
            const data = fs.readFileSync(dbPath, 'utf8');
            return JSON.parse(data);
        }
    } catch (err) {
        console.error('Error reading database file:', err);
    }
    return { orders: [], bookings: [] };
}

function saveDb(data) {
    try {
        fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
        console.error('Error writing database file:', err);
    }
}

// Serve static frontend files
app.use(express.static(path.join(__dirname, '..')));

// Serve index.html at the root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// --- API Endpoints ---

// 1. Post a new order
app.post('/api/orders', (req, res) => {
    try {
        const { client_name, client_email, address, city, postcode, phone, items, shipping_method, shipping_fee, total } = req.body;

        // Backend validation
        if (!client_name || !client_email || !address || !city || !postcode || !phone || !items || !shipping_method) {
            return res.status(400).json({ error: 'Missing required delivery fields.' });
        }
        if (!client_email.includes('@')) {
            return res.status(400).json({ error: 'Invalid email address format.' });
        }
        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'Shopping bag is empty.' });
        }

        const orderId = 'AJ-' + Math.floor(10000 + Math.random() * 90000);
        const createdAt = Date.now();
        const itemsJson = JSON.stringify(items);

        const dbData = loadDb();
        dbData.orders.push({
            id: orderId,
            client_name: client_name.trim(),
            client_email: client_email.trim(),
            address: address.trim(),
            city: city.trim(),
            postcode: postcode.trim(),
            phone: phone.trim(),
            items: itemsJson,
            shipping_method,
            shipping_fee: parseFloat(shipping_fee) || 0,
            total: parseFloat(total) || 0,
            status: 1, // 1: CAD, 2: Casting, 3: Gem Setting, 4: Audit, 5: Transit
            created_at: createdAt
        });
        saveDb(dbData);

        res.status(201).json({ success: true, orderId, total, status: 1 });
    } catch (e) {
        console.error('Order route exception:', e);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// 2. Get order status by ID
app.get('/api/orders/:id', (req, res) => {
    const orderId = req.params.id;
    const dbData = loadDb();
    const row = dbData.orders.find(o => o.id === orderId);
    
    if (!row) {
        return res.status(404).json({ error: 'Order not found.' });
    }
    
    res.json({
        id: row.id,
        status: row.status,
        total: row.total,
        created_at: row.created_at,
        client_name: row.client_name
    });
});

// 3. Simulate order progress (for tracker demo)
app.post('/api/orders/:id/simulate-progress', (req, res) => {
    const orderId = req.params.id;
    const dbData = loadDb();
    const order = dbData.orders.find(o => o.id === orderId);
    
    if (!order) return res.status(404).json({ error: 'Order not found.' });

    order.status = order.status < 5 ? order.status + 1 : 5;
    saveDb(dbData);
    
    res.json({ success: true, orderId, status: order.status });
});

// 4. Create a new consultation booking
app.post('/api/bookings', (req, res) => {
    try {
        const { type, date, time, client_name, client_email, message } = req.body;

        // Validation
        if (!type || !date || !time || !client_name || !client_email) {
            return res.status(400).json({ error: 'Missing booking parameters.' });
        }
        if (!client_email.includes('@')) {
            return res.status(400).json({ error: 'Invalid email address.' });
        }

        const dbData = loadDb();
        const slotTaken = dbData.bookings.some(b => b.date === date && b.time === time && b.type === type);
        
        if (slotTaken) {
            return res.status(409).json({ error: 'This time slot is already reserved. Please select another slot.' });
        }

        const bookingId = 'BK-' + Math.floor(10000 + Math.random() * 90000);
        const createdAt = Date.now();

        dbData.bookings.push({
            id: bookingId,
            type,
            date,
            time,
            client_name: client_name.trim(),
            client_email: client_email.trim(),
            message: message ? message.trim() : '',
            created_at: createdAt
        });
        saveDb(dbData);

        res.status(201).json({ success: true, bookingId, type, date, time });
    } catch (e) {
        console.error('Booking exception:', e);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// 5. Export booking details to an .ics calendar file
app.get('/api/bookings/export-ics', (req, res) => {
    const bookingId = req.query.id;
    if (!bookingId) {
        return res.status(400).send('Booking ID is required.');
    }

    const dbData = loadDb();
    const row = dbData.bookings.find(b => b.id === bookingId);
    
    if (!row) {
        return res.status(404).send('Booking not found.');
    }

    // Create start date in UTC or parse safely
    // date format: "YYYY-MM-DD", time format: "HH:MM" (24-hour style, e.g. "11:00" or "15:30")
    const dateParts = row.date.split('-'); // [YYYY, MM, DD]
    const timeParts = row.time.split(':'); // [HH, MM]
    
    const year = dateParts[0];
    const month = dateParts[1];
    const day = dateParts[2];
    const hour = timeParts[0];
    const minute = timeParts[1];

    // DTSTART: YYYYMMDDTHHMMSSZ (AEST is GMT+10, let's represent standard string)
    const formatStr = `${year}${month}${day}T${hour}${minute}00`;
    
    // Duration: 1 hour
    const endHour = String(parseInt(hour, 10) + 1).padStart(2, '0');
    const endFormatStr = `${year}${month}${day}T${endHour}${minute}00`;

    const nowFormatted = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

    const icsContent = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Ajay The Jeweller//VIP Consultation//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'BEGIN:VEVENT',
        `UID:${row.id}@ajaythejeweller.com`,
        `DTSTAMP:${nowFormatted}`,
        `DTSTART;TZID=Australia/Sydney:${formatStr}`,
        `DTEND;TZID=Australia/Sydney:${endFormatStr}`,
        `SUMMARY:${row.type} - Ajay The Jeweller`,
        `DESCRIPTION:VIP Consultation Session\\nClient: ${row.client_name}\\nEmail: ${row.client_email}\\nNotes: ${row.message || 'None'}`,
        `LOCATION:Atelier Sydney / Secure Video Room`,
        'STATUS:CONFIRMED',
        'SEQUENCE:0',
        'END:VEVENT',
        'END:VCALENDAR'
    ].join('\r\n');

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=ajay-booking-${row.id}.ics`);
    res.send(icsContent);
});

// 6. Streaming AI chatbot assistant
app.post('/api/chat', (req, res) => {
    try {
        const { query } = req.body;
        console.log("Chat query received:", query);
        
        // Input validation
        if (typeof query !== 'string' || !query.trim()) {
            return res.status(400).json({ error: 'Query must be a non-empty string.' });
        }
        
        const sanitizedQuery = query.substring(0, 500).trim();
        
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders(); // Establish connection immediately
        
        // Check for Order ID lookup (AJ-XXXXX)
        const orderMatch = sanitizedQuery.match(/AJ-(\d{5})/i);
        if (orderMatch) {
            const orderId = orderMatch[0].toUpperCase();
            const dbData = loadDb();
            const row = dbData.orders.find(o => o.id === orderId);
            
            if (!row) {
                streamText(`I looked up the order ID **${orderId}** in our secure vault ledger, but no matching records were found. Please verify the ID and try again.`, res, req);
                return;
            }
            
            const stages = [
                "CAD Design & 3D Modeling (Stage 1/5)",
                "Casting & Metal Refinement (Stage 2/5)",
                "Hand Setting Diamonds & Gemstones (Stage 3/5)",
                "Acoustic Quality Audit & Review (Stage 4/5)",
                "Dispatched via Insured Courier (Stage 5/5)"
            ];
            const stageName = stages[row.status - 1] || "Processing";
            const orderDate = new Date(row.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
            const text = `Hello **${row.client_name}**, I have retrieved your order **${row.id}** from our system:\n\n` +
                         `* **Fabrication Stage**: ${stageName}\n` +
                         `* **Total Value**: $${row.total.toLocaleString()} AUD\n` +
                         `* **Order Date**: ${orderDate}\n\n` +
                         `Our Sydney workshop is crafting your bespoke heirloom. Let me know if you want to know what happens in this stage!`;
            streamText(text, res, req);
            return;
        }
        
        // Check for Booking ID lookup (BK-XXXXX)
        const bookingMatch = sanitizedQuery.match(/BK-(\d{5})/i);
        if (bookingMatch) {
            const bookingId = bookingMatch[0].toUpperCase();
            const dbData = loadDb();
            const row = dbData.bookings.find(b => b.id === bookingId);
            
            if (!row) {
                streamText(`I searched for the consultation booking **${bookingId}**, but did not find any matching record. Please verify your appointment details.`, res, req);
                return;
            }
            
            const text = `Hello **${row.client_name}**, I have verified your VIP appointment **${row.id}**:\n\n` +
                         `* **Type**: ${row.type}\n` +
                         `* **Date**: ${row.date}\n` +
                         `* **Time**: ${row.time} AEST\n\n` +
                         `Your session is confirmed. We look forward to welcome you to our Sydney workshop or secure video conference!`;
            streamText(text, res, req);
            return;
        }
        
        // Check FAQ intent
        let replyText = "";
        const queryLower = sanitizedQuery.toLowerCase();
        
        if (queryLower.includes("gold") || queryLower.includes("alloy") || queryLower.includes("carat") || queryLower.includes("karat") || queryLower.includes("platinum") || queryLower.includes("metal")) {
            replyText = "At Ajay The Jeweller, we only work with the finest solid alloys. We never work with plated or gold-filled base metals. Our collection includes:\n\n" +
                        "* **18k Yellow Gold**: Rich warm tone, 75% pure gold, alloyed for optimal structural durability.\n" +
                        "* **18k White Gold**: Finished with a premium rhodium guard for high specular mirror-reflection.\n" +
                        "* **18k Rose Gold**: Sculpted with pure copper alloy to create a timeless, romantic blush hue.\n" +
                        "* **Platinum (950)**: Deep metallic gray lustre, highly hypoallergenic, extremely dense and durable.";
        } else if (queryLower.includes("size") || queryLower.includes("sizing") || queryLower.includes("ring size")) {
            replyText = "Finding your correct size is vital to ensuring a lifetime of comfortable wear:\n\n" +
                        "* **Rings & Bands**: We offer a complimentary ring sizing kit shipped to your home. You can request it via the customizer or during booking. Alternatively, you can measure the inside diameter of an existing ring.\n" +
                        "* **Watches**: Custom watches are fitted with adjustable links. Default settings cover wrist diameters from 16cm to 21cm.\n" +
                        "* **Complimentary Resizing**: We provide one complimentary resizing within 60 days of purchase on all rings and bracelets.";
        } else if (queryLower.includes("shipping") || queryLower.includes("delivery") || queryLower.includes("transit") || queryLower.includes("courier")) {
            replyText = "We understand the value of security during delivery:\n\n" +
                        "* **Security Vault Courier**: Every high-jewelry piece is dispatched via private secure couriers (such as Malca-Amit or Armaguard).\n" +
                        "* **Fully Insured**: Shipments are 100% insured from the Sydney workshop to your doorstep.\n" +
                        "* **Delivery Requirements**: An adult signature and ID verification is strictly required upon delivery. We do not ship to PO Boxes.\n" +
                        "* **Standard Transit**: Fabrication takes 3-4 weeks, followed by next-day express delivery in Australia, and 3-5 days international shipping.";
        } else if (queryLower.includes("return") || queryLower.includes("refund") || queryLower.includes("policy") || queryLower.includes("exchange")) {
            replyText = "Due to the individualized, high-fashion custom nature of our creations:\n\n" +
                        "* **Bespoke Pieces**: All custom-crafted pieces (including initials engravings or canvas customization designs) are final sale.\n" +
                        "* **Standard Curated Collection**: Items purchased from our stock curated collection can be exchanged or returned for store credit within 14 days of delivery, provided they are in unworn, brand-new condition with vault tags intact.\n" +
                        "* **Resizing Guard**: We support sizing resizing adjustments if needed.";
        } else if (queryLower.includes("book") || queryLower.includes("consult") || queryLower.includes("appointment") || queryLower.includes("schedule") || queryLower.includes("meet")) {
            replyText = "You can schedule a private VIP consultation using the calendar scheduling tool located on the homepage under the **Private Appointment** section. We offer:\n\n" +
                        "* **Virtual Design Review**: Join a secure zoom screen-share with our designers to approve 3D CAD modeling.\n" +
                        "* **Sydney Atelier Session**: Visit our Sydney vault studio for hands-on gemstone selection.\n" +
                        "* **Availability**: Sessions are held Monday through Friday from 10:00 AM to 5:00 PM. Weekends and past dates are automatically blocked.";
        } else if (queryLower.includes("clean") || queryLower.includes("care") || queryLower.includes("maintain") || queryLower.includes("wash")) {
            replyText = "To maintain the pristine brilliance of your diamonds and gold:\n\n" +
                        "1. **Gentle Bath**: Soak the piece in warm water with a few drops of mild dish soap for 10-15 minutes.\n" +
                        "2. **Soft Brush**: Use a brand-new, ultra-soft toothbrush to gently clean behind the gemstone baskets where dust gathers.\n" +
                        "3. **Rinse & Dry**: Rinse thoroughly in clean water and pat dry using a lint-free microfibre cloth.\n" +
                        "4. **Professional Audit**: Bring your piece to our Sydney workshop once a year for a complimentary ultrasonic wash and prong tightness check.";
        } else if (queryLower.includes("custom") || queryLower.includes("design") || queryLower.includes("cad") || queryLower.includes("customizer")) {
            replyText = "Our custom jewelry customization pathway gives you full control:\n\n" +
                        "* **Interactive Studio**: Scroll down to our **Atelier Customizer** interactive canvas to select alloys (Yellow, Rose, White Gold or Platinum), carats, initials engravings, and diamond placements.\n" +
                        "* **3D CAD Review**: Every order begins with a photorealistic 3D blueprint rendered by our designers. We refine it until you approve, before entering metal casting.";
        } else if (queryLower.includes("hello") || queryLower.includes("hi") || queryLower.includes("hey") || queryLower.includes("greetings") || queryLower.includes("pleasant") || queryLower.includes("help")) {
            replyText = "Welcome to the Atelier. I am your AI Assistant. How can I help you today?\n\n" +
                        "You can check:\n" +
                        "1. **Track an Order**: Type your Order ID (e.g., `AJ-12345`).\n" +
                        "2. **Verify a Booking**: Type your Booking ID (e.g., `BK-12345`).\n" +
                        "3. **Learn about Alloys**: Ask me about White Gold, Yellow Gold, Rose Gold, or Platinum.\n" +
                        "4. **Care Instructions**: Ask how to clean your high-jewelry diamonds.";
        } else {
            replyText = "I want to make sure I assist you perfectly. I can help you with:\n\n" +
                        "* **Order Status**: Please write your Order ID (e.g. `AJ-12345`).\n" +
                        "* **VIP Bookings**: Write your Booking ID (e.g. `BK-12345`).\n" +
                        "* **Jewelry FAQs**: Ask about ring sizing, resizing rules, security courier transit, return policies, or metal alloys.\n\n" +
                        "What details can I lookup or answer for you?";
        }
        
        streamText(replyText, res, req);
    } catch (e) {
        console.error("Chat route exception:", e);
        res.status(500).json({ error: "Internal chat server error." });
    }
});

function streamText(text, res, req) {
    console.log("streamText called. Text length:", text ? text.length : 'null');
    const tokens = text.split(/(\s+)/);
    let tokenIndex = 0;
    
    const interval = setInterval(() => {
        console.log("Streaming token index:", tokenIndex, "total tokens:", tokens.length);
        if (tokenIndex >= tokens.length) {
            console.log("Streaming complete. Sending DONE.");
            clearInterval(interval);
            res.write(`data: [DONE]\n\n`);
            res.end();
            return;
        }
        
        const token = tokens[tokenIndex++];
        res.write(`data: ${JSON.stringify({ text: token })}\n\n`);
    }, 20);
    
    res.on('close', () => {
        console.log("Response close event fired! Clearing interval.");
        clearInterval(interval);
    });
}

// Start server (only if not running on Vercel)
if (process.env.VERCEL !== '1' && process.env.NOW_BUILDER !== '1') {
    app.listen(PORT, HOST, () => {
        console.log(`Server is running at http://${HOST}:${PORT}`);
    });
}

module.exports = app;
