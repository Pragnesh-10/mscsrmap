// Mobile Navigation Toggle
const hamburger = document.querySelector(".hamburger");
const navMenu = document.querySelector(".nav-menu");

hamburger.addEventListener("click", () => {
  hamburger.classList.toggle("active");
  navMenu.classList.toggle("active");

  // Toggle body scroll lock
  if (navMenu.classList.contains('active')) {
    document.body.style.overflow = 'hidden';
  } else {
    document.body.style.overflow = '';
  }
});

// Close menu when clicking outside
document.addEventListener('click', (e) => {
  if (!hamburger.contains(e.target) && !navMenu.contains(e.target)) {
    navMenu.classList.remove('active');
    hamburger.classList.remove('active');
    document.body.style.overflow = '';
  }
});

// Close mobile menu when clicking on a link
document.querySelectorAll(".nav-link").forEach((n) =>
  n.addEventListener("click", () => {
    hamburger.classList.remove("active");
    navMenu.classList.remove("active");
    document.body.style.overflow = '';
  })
);

// Smooth scrolling for navigation links and checkpoint dots with offset for fixed navbar
document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener("click", function (e) {
    e.preventDefault();
    const targetId = this.getAttribute("href");
    const target = document.querySelector(targetId);

    // Close mobile menu if open
    const navMenu = document.querySelector('.nav-menu');
    const hamburger = document.querySelector('.hamburger');
    if (navMenu && navMenu.classList.contains('active')) {
      navMenu.classList.remove('active');
      hamburger.classList.remove('active');
      document.body.style.overflow = '';
    }

    if (target) {
      const navbarHeight = 100; // Adjust based on navbar height
      const targetPosition = target.offsetTop - navbarHeight;

      window.scrollTo({
        top: targetPosition,
        behavior: "smooth"
      });

      // Update active nav link
      document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
      });
      this.classList.add('active');
    }
  });
});


// Event Modal Functionality
const eventModal = document.getElementById('eventModal');
const closeModal = document.getElementById('closeModal');
const modalTitle = document.getElementById('modalTitle');
const modalDate = document.getElementById('modalDate');
const modalBody = document.getElementById('modalBody');

// Event data for modals
const eventData = {
  'hackmsc2': {
    title: '<hack>2.0</msc>',
    date: 'NOV 1-2',
    sections: [
      {
        title: 'About the Hackathon',
        content: `<p>Solutions for Smart India is a national-level hackathon designed to encourage students to innovate and build impactful technology solutions that improve everyday life for Indians and contribute to the nation's progress.</p>`
      },
      {
        title: 'Event Details',
        content: `<ul>
          <li>Duration: 30 hours non-stop coding marathon</li>
          <li>Date: November 1st 11:00 AM - November 2nd 6:00 PM</li>
          <li>Venue: SRM University AP</li>
          <li>Team Size: 2-4 members</li>
        </ul>`
      },
      {
        title: 'Why Participate?',
        content: `<ul>
          <li>Win exciting prizes and certificates</li>
          <li>Network with industry professionals</li>
          <li>Showcase your skills to potential recruiters</li>
          <li>Get mentorship from experienced developers</li>
          <li>Access to latest Microsoft technologies</li>
        </ul>`
      },
      {
        title: 'Problem Statements',
        content: `<p>Solve real-world problems in domains like Healthcare, Education, Agriculture, Smart Cities, and Sustainability. Detailed problem statements will be revealed on the event day.</p>`
      }
    ]
  }
};

// Open modal function
function openEventModal(eventId) {
  const data = eventData[eventId];
  if (!data) return;

  modalTitle.textContent = data.title;
  modalDate.textContent = data.date;

  // Build modal body
  let bodyHTML = '';
  data.sections.forEach(section => {
    bodyHTML += `
      <div class="event-modal-section">
        <h4>${section.title}</h4>
        ${section.content}
      </div>
    `;
  });
  modalBody.innerHTML = bodyHTML;

  // Show modal with animation
  eventModal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

// Close modal
if (closeModal) {
  closeModal.addEventListener('click', () => {
    eventModal.classList.remove('active');
    document.body.style.overflow = '';
  });
}

// Close on outside click
if (eventModal) {
  eventModal.addEventListener('click', (e) => {
    if (e.target === eventModal) {
      eventModal.classList.remove('active');
      document.body.style.overflow = '';
    }
  });
}

// Close on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && eventModal && eventModal.classList.contains('active')) {
    eventModal.classList.remove('active');
    document.body.style.overflow = '';
  }
});

// Attach event listeners to Learn More buttons
document.addEventListener('DOMContentLoaded', () => {
  const learnMoreBtn = document.getElementById('hackmsc2-more-btn');
  if (learnMoreBtn) {
    learnMoreBtn.addEventListener('click', () => openEventModal('hackmsc2'));
  }
});


// Event registration functionality
document.querySelectorAll(".register-btn").forEach((btn) => {
  btn.addEventListener("click", (e) => {
    e.preventDefault();

    // Create a simple modal for registration
    const modal = document.createElement("div");
    modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            backdrop-filter: blur(5px);
        `;

    modal.innerHTML = `
            <div style="
                background: linear-gradient(135deg, #1a1a2e, #16213e);
                padding: 2rem;
                border-radius: 15px;
                border: 1px solid rgba(27, 27, 27, 0.3);
                max-width: 400px;
                width: 90%;
                text-align: center;
            ">
                <h3 style="color: #ffffff; margin-bottom: 1rem;">Event Registration</h3>
                <p style="color: #e0e0e0; margin-bottom: 1.5rem;">Registrations has been closed.</p>
                <button onclick="this.parentElement.parentElement.remove()" style="
                    background: linear-gradient(135deg, #4a90e2);
                    color: white;
                    border: none;
                    padding: 0.8rem 1.5rem;
                    border-radius: 8px;
                    font-weight: 600;
                    cursor: pointer;
                ">Close</button>
            </div>
        `;

    document.body.appendChild(modal);

    // Close modal when clicking outside
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  });
});

// Web3Forms Contact Form Handling
const contactForm = document.getElementById("contact-form");
const formStatus = document.getElementById("form-status");
const submitBtn = document.getElementById("submit-btn");

if (contactForm) {
  contactForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Get form data
    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const message = document.getElementById("message").value.trim();

    // Enhanced validation
    if (!name || !email || !message) {
      showStatus("Please fill in all fields.", "error");
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      showStatus("Please enter a valid email address.", "error");
      return;
    }

    // Show loading state
    submitBtn.disabled = true;
    submitBtn.textContent = "Sending...";
    showStatus("Sending your message...", "info");

    try {
      // Prepare form data for Web3Forms
      const formData = new FormData(contactForm);

      // Send to Web3Forms
      const response = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        showStatus(
          "Message sent successfully! We'll get back to you soon.",
          "success"
        );
        contactForm.reset();
      } else {
        throw new Error(result.message || "Failed to send email");
      }
    } catch (error) {
      console.error("Form submission failed:", error);
      showStatus(
        "Failed to send message. Please try again later.",
        "error"
      );
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Send Message";
    }
  });

  function showStatus(message, type) {
    formStatus.textContent = message;
    formStatus.className = `form-status ${type}`;
    setTimeout(() => {
      formStatus.textContent = "";
      formStatus.className = "form-status";
    }, 5000);
  }
}

// Scroll Spy for Checkpoint Dots
document.addEventListener('DOMContentLoaded', () => {
  const dots = document.querySelectorAll('.checkpoint-dot');
  const sections = document.querySelectorAll('section[id]');

  const observerOptions = {
    threshold: 0.3, // Trigger when 30% of section is visible
    rootMargin: "-20% 0px -20% 0px" // Adjust detection zone
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.getAttribute('id');

        // Remove active from all
        dots.forEach(dot => dot.classList.remove('active'));

        // Add active to current
        const activeDot = document.querySelector(`.checkpoint-dot[data-section="${id}"]`);
        if (activeDot) {
          activeDot.classList.add('active');
        }
      }
    });
  }, observerOptions);

  sections.forEach(section => {
    observer.observe(section);
  });

  // Also update on click to be instant
  dots.forEach(dot => {
    dot.addEventListener('click', function () {
      dots.forEach(d => d.classList.remove('active'));
      this.classList.add('active');
    });
  });
});

// Parallax effect to hero background
window.addEventListener("scroll", () => {
  const scrolled = window.pageYOffset;
  const parallaxElements = document.querySelectorAll(".glow-circle");

  parallaxElements.forEach((element, index) => {
    const speed = 0.5 + index * 0.1;
    element.style.transform = `translateY(${scrolled * speed}px)`;
  });
});

// Typing effect removed â€” preserves hero title span structure for gradient styling

// Hover effects to cards
document.querySelectorAll(".event-card, .founder-card").forEach((card) => {
  card.addEventListener("mouseenter", () => {
    card.style.transform = "translateY(-10px) scale(1.02)";
  });

  card.addEventListener("mouseleave", () => {
    card.style.transform = "translateY(0) scale(1)";
  });
});

// Smooth Page Transitions
document.addEventListener('DOMContentLoaded', () => {
  // Handle page transition links
  const transitionLinks = document.querySelectorAll('.page-transition');

  transitionLinks.forEach(link => {
    link.addEventListener('click', function (e) {
      e.preventDefault();
      const href = this.getAttribute('href');

      // Fade out animation
      document.body.style.animation = 'fadeOut 0.4s ease-in-out';

      setTimeout(() => {
        window.location.href = href;
      }, 400);
    });
  });
});

// Add fadeOut animation
const style = document.createElement('style');
style.textContent = `
  @keyframes fadeOut {
    from {
      opacity: 1;
      transform: translateY(0);
    }
    to {
      opacity: 0;
      transform: translateY(-20px);
    }
  }
`;
document.head.appendChild(style);

// Delayed Background Video Playback
window.addEventListener("load", () => {
  const bgVideo = document.getElementById('bgVideo');

  // Delay video start by 1 second to prevent glitching
  if (bgVideo) {
    // Set video properties
    bgVideo.muted = true;
    bgVideo.playsInline = true;

    setTimeout(() => {
      bgVideo.play().catch(err => {
        console.log('Video autoplay prevented:', err);
        // Try again after a short delay
        setTimeout(() => {
          bgVideo.play().catch(e => console.log('Second attempt failed:', e));
        }, 500);
      });
    }, 1000);
  }
});

// Loading Screen Progress Bar
window.addEventListener('load', () => {
  const loadingScreen = document.getElementById('loadingScreen');
  const loadingBar = document.getElementById('loadingBar');

  if (loadingBar) {
    let width = 0;
    const interval = setInterval(() => {
      if (width >= 100) {
        clearInterval(interval);

        // Use a small timeout to ensure the bar looks full before fading
        setTimeout(() => {
          loadingScreen.classList.add('hidden');
          setTimeout(() => {
            loadingScreen.style.display = 'none';
          }, 500);
        }, 200);

      } else {
        width += Math.random() * 10; // Random increment
        if (width > 100) width = 100;
        loadingBar.style.width = width + '%';
      }
    }, 100); // Update every 100ms
  } else {
    // Fallback if elements missing
    loadingScreen.classList.add('hidden');
  }
});

// Smooth page load (no flash)
document.body.style.opacity = "1";
