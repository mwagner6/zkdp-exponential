import { useState } from 'react'
import './App.css'
import NavigationButton from './components/navigation/NavigationButton'
import ZeroKnowledgePage from './components/pages/ZeroKnowledgePage'
import SigmaProtocolPage from './components/pages/SigmaProtocolPage'
import GameScreen from './components/pages/GameScreen'

function App() {
  const [currentPage, setCurrentPage] = useState(1)
  const [transitionDirection, setTransitionDirection] = useState<'left' | 'right' | null>(null)
  const [isTransitioning, setIsTransitioning] = useState(false)

  const pages = [
    {
      title: "Zero-Knowledge Proofs",
      content: <ZeroKnowledgePage />
    },
    {
      title: "Sigma-OR Protocol",
      content: <SigmaProtocolPage />
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
  const isGameScreen = currentPage === 3;
  const contentClass = isGameScreen 
    ? 'game-screen'
    : transitionDirection 
      ? `content slide-out-${transitionDirection}`
      : `content slide-in-${transitionDirection === 'left' ? 'right' : 'left'}`;

  return (
    <div className="app">
      {!isGameScreen && (
        <div className="content-container">
          {currentPage > 1 && (
            <NavigationButton 
              direction="back"
              onClick={() => handleNavigation('back')}
              disabled={isTransitioning}
            />
          )}
          <div className={contentClass}>
            <h1>{currentPageContent.title}</h1>
            {currentPageContent.content}
          </div>
          {currentPage < pages.length && (
            <NavigationButton 
              direction="next"
              onClick={() => handleNavigation('next')}
              disabled={isTransitioning}
            />
          )}
        </div>
      )}
      {isGameScreen && currentPageContent.content}
    </div>
  )
}

export default App
