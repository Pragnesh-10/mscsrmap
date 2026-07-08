'use client';

import { useEffect } from 'react';

export default function EventsClientLogic() {
  useEffect(() => {
    const cDot = document.getElementById("cDot");
    const cRing = document.getElementById("cRing");

    if (cDot && cRing) {
      document.body.classList.add("has-custom-cursor");
      let e = 0, t = 0, n = 0, o = 0;
      
      const a = (e: MouseEvent) => {
        n = e.clientX;
        o = e.clientY;
        cDot.style.left = `${n}px`;
        cDot.style.top = `${o}px`;
      };
      
      window.addEventListener("mousemove", a);
      
      let animId: number;
      function r() {
        e += (n - e) * 0.15;
        t += (o - t) * 0.15;
        if (cRing) {
          cRing.style.left = `${e}px`;
          cRing.style.top = `${t}px`;
        }
        animId = requestAnimationFrame(r);
      }
      animId = requestAnimationFrame(r);
      
      const s = document.querySelectorAll("a, button, .nav-link, .event-cassette");
      s.forEach((el) => {
        el.addEventListener("mouseenter", () => {
          cDot.classList.add("h");
          cRing.classList.add("h");
        });
        el.addEventListener("mouseleave", () => {
          cDot.classList.remove("h");
          cRing.classList.remove("h");
        });
      });

      // Cleanup
      return () => {
        window.removeEventListener("mousemove", a);
        cancelAnimationFrame(animId);
        document.body.classList.remove("has-custom-cursor");
      };
    }
  }, []);

  useEffect(() => {
    const handlePageShow = () => {
      document.body.style.overflow = "";
    };
    window.addEventListener("pageshow", handlePageShow);
    
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);

  useEffect(() => {
    const hamburger = document.querySelector(".hamburger");
    const navMenu = document.querySelector(".nav-menu");
    
    if (hamburger && navMenu) {
      const handleHamburgerClick = () => {
        hamburger.classList.toggle("active");
        navMenu.classList.toggle("active");
        document.body.style.overflow = navMenu.classList.contains("active") ? "hidden" : "";
      };
      
      const handleDocClick = (e: Event) => {
        if (!hamburger.contains(e.target as Node) && !navMenu.contains(e.target as Node)) {
          navMenu.classList.remove("active");
          hamburger.classList.remove("active");
          document.body.style.overflow = "";
        }
      };

      hamburger.addEventListener("click", handleHamburgerClick);
      document.addEventListener("click", handleDocClick);
      
      document.querySelectorAll(".nav-link").forEach((e) =>
        e.addEventListener("click", () => {
          hamburger.classList.remove("active");
          navMenu.classList.remove("active");
          document.body.style.overflow = "";
        })
      );
      
      return () => {
        hamburger.removeEventListener("click", handleHamburgerClick);
        document.removeEventListener("click", handleDocClick);
      };
    }
  }, []);

  useEffect(() => {
    const heroTitle = document.querySelector(".hero-title");
    const heroSubtitle = document.querySelector(".hero-subtitle");
    
    const handleScroll = () => {
      const e = window.scrollY;
      if (heroTitle && heroSubtitle) {
        if (e > 100) {
          heroTitle.classList.add("scrolled");
          heroSubtitle.classList.add("scrolled");
        } else {
          heroTitle.classList.remove("scrolled");
          heroSubtitle.classList.remove("scrolled");
        }
      }
      
      const navbar = document.querySelector(".navbar") as HTMLElement;
      const overlay = document.querySelector(".background-overlay") as HTMLElement;
      if (overlay) {
        const o = 0.7 + 0.15 * Math.min(window.scrollY / window.innerHeight, 1);
        overlay.style.background = `rgba(0, 0, 0, ${o})`;
      }
      
      if (navbar) {
        if (window.scrollY > 100) {
          navbar.style.background = "rgba(15, 15, 20, 0.75)";
          navbar.style.backdropFilter = "blur(25px) saturate(150%)";
          navbar.style.boxShadow = "0 4px 24px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.08)";
        } else {
          navbar.style.background = "rgba(10, 10, 15, 0.6)";
          navbar.style.backdropFilter = "blur(20px) saturate(140%)";
          navbar.style.boxShadow = "0 4px 24px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.05)";
        }
      }
    };
    
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    // 3. CASSETTE EXPANSION from the previous script (the user's new script is missing this core functionality for the events page!)
    // I am including it here because without it, the events don't open.
    const eventCards = document.querySelectorAll('.event-cassette');
    const handleCardClick = (card: Element, e: Event) => {
      if ((e.target as Element).closest('.event-summary-drawer') || (e.target as Element).closest('a')) {
        return;
      }

      const wasExpanded = card.classList.contains('expanded');

      eventCards.forEach(other => {
        if (other !== card && other.classList.contains('expanded')) {
          other.classList.remove('expanded');
          const otherDrawer = other.querySelector('.event-summary-drawer') as HTMLElement;
          if (otherDrawer) otherDrawer.style.maxHeight = '';
        }
      });

      card.classList.toggle('expanded');
      const drawer = card.querySelector('.event-summary-drawer') as HTMLElement;
      if (drawer) {
        if (!wasExpanded) {
          drawer.style.maxHeight = drawer.scrollHeight + 40 + 'px';
        } else {
          drawer.style.maxHeight = '';
        }
      }
    };

    eventCards.forEach(card => {
      card.addEventListener('click', (e) => handleCardClick(card, e));
    });

    // 4. CATEGORY FILTERING
    const filterBtns = document.querySelectorAll('.filter-btn');
    const handleFilterClick = (btn: Element, e: Event) => {
      e.stopPropagation();
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const filterVal = btn.getAttribute('data-filter');

      eventCards.forEach(card => {
        const category = card.getAttribute('data-category');
        card.classList.remove('expanded');
        const drawer = card.querySelector('.event-summary-drawer') as HTMLElement;
        if (drawer) drawer.style.maxHeight = '';

        const shouldShow = (filterVal === 'all' || category === filterVal);

        if (shouldShow) {
          card.classList.remove('filtered-out');
          (card as HTMLElement).style.display = '';
          void (card as HTMLElement).offsetWidth;
          (card as HTMLElement).style.opacity = '1';
          (card as HTMLElement).style.transform = 'translateY(0) scale(1)';
        } else {
          card.classList.add('filtered-out');
          (card as HTMLElement).style.opacity = '0';
          (card as HTMLElement).style.transform = 'translateY(8px) scale(0.97)';
          setTimeout(() => {
            if (card.classList.contains('filtered-out')) {
              (card as HTMLElement).style.display = 'none';
            }
          }, 380);
        }
      });
    };

    filterBtns.forEach(btn => {
      btn.addEventListener('click', (e) => handleFilterClick(btn, e));
    });

    // 5. STAGGERED REVEAL ANIMATION
    eventCards.forEach((card, idx) => {
      (card as HTMLElement).style.opacity = '0';
      (card as HTMLElement).style.transform = 'translateY(18px)';
      (card as HTMLElement).style.transition = 'opacity 0.55s ease, transform 0.55s var(--ease), border-color 0.3s ease, box-shadow 0.3s ease';
      setTimeout(() => {
        (card as HTMLElement).style.opacity = '1';
        (card as HTMLElement).style.transform = 'translateY(0)';
      }, idx * 90 + 200);
    });

    // 6. Registration Modal Logic Removed
    // The link now natively navigates to the event portal route.

    return () => {
      eventCards.forEach(card => card.replaceWith(card.cloneNode(true)));
      filterBtns.forEach(btn => btn.replaceWith(btn.cloneNode(true)));
    }
  }, []);

  return (
    <>
      <div className="c-dot" id="cDot"></div>
      <div className="c-ring" id="cRing"></div>
    </>
  );
}
