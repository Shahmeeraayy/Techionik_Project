import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function SiteMotion({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    window.scrollTo({ top: 0, behavior: 'auto' });

    const context = gsap.context(() => {
      gsap.fromTo(
        '.premium-card, .dashboard-preview, .admin-content > *, .tech-shell section',
        { autoAlpha: 0, y: 18, scale: 0.992 },
        {
          autoAlpha: 1,
          y: 0,
          scale: 1,
          duration: 0.72,
          ease: 'power3.out',
          stagger: 0.045,
          scrollTrigger: {
            trigger: document.body,
            start: 'top 82%',
            end: 'bottom top',
            toggleActions: 'play none none none',
          },
        },
      );
    });

    return () => {
      context.revert();
      ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
    };
  }, [location.pathname]);

  return <>{children}</>;
}
