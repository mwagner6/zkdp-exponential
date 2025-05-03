import { useState } from 'react'
import './App.css'
import IntroductionPage from './components/pages/IntroductionPage'
import GameScreen from './components/pages/GameScreen'
import IntroNavbar from './components/navigation/IntroNavbar'

function App() {
  const [currentPage, setCurrentPage] = useState(1)
  const [transitionDirection, setTransitionDirection] = useState<'left' | 'right' | null>(null)
  const [isTransitioning, setIsTransitioning] = useState(false)

  const pages = [
    {
      title: "Introduction",
      content: <IntroductionPage />
    },
    {
      title: "Interactive Demo",
      content: <GameScreen onBack={() => handleNavigation('back')} />
    }
  ]

  const handleNavigation = (direction: 'next' | 'back') => {
    if (isTransitioning) return;
    
    setIsTransitioning(true);
    setTransitionDirection(direction === 'next' ? 'left' : 'right');
    
    setTimeout(() => {
      setCurrentPage(prev => direction === 'next' ? prev + 1 : prev - 1);
      setTransitionDirection(null);
      setIsTransitioning(false);
    }, 0);
  };

  const currentPageContent = pages[currentPage - 1]
  const isGameScreen = currentPage === 2;
  const contentClass = isGameScreen 
    ? 'game-screen'
    : transitionDirection 
      ? `content slide-out-${transitionDirection}`
      : `content slide-in-${transitionDirection === 'left' ? 'right' : 'left'}`;

  return (
    <div className="app">
      {!isGameScreen && (
        <>
          <IntroNavbar 
            onNext={() => handleNavigation('next')}
            disabled={isTransitioning}
          />
          <div className="content-container pt-[60px]">
            <div className={contentClass}>
              {currentPageContent.content}
            </div>
          </div>
        </>
      )}
      {isGameScreen && currentPageContent.content}
    </div>
  )
}

export default App
