import React, { useState, useEffect, useRef } from 'react';
import { Avatar, AvatarFallback } from './ui/avatar';
import { User } from 'lucide-react';

export default function ClientMentionDropdown({ 
  clients, 
  isVisible, 
  searchTerm, 
  onSelect, 
  position 
}) {
  const [filteredClients, setFilteredClients] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (!clients) return;
    
    const filtered = clients.filter(client =>
      client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.email.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredClients(filtered);
    setSelectedIndex(0);
  }, [clients, searchTerm]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isVisible || filteredClients.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => 
            prev < filteredClients.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => 
            prev > 0 ? prev - 1 : filteredClients.length - 1
          );
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredClients[selectedIndex]) {
            onSelect(filteredClients[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onSelect(null);
          break;
        default:
          // Do nothing for other keys
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isVisible, filteredClients, selectedIndex, onSelect]);

  if (!isVisible || filteredClients.length === 0) {
    return null;
  }

  return (
    <div
      ref={dropdownRef}
      data-mention-dropdown
      className="fixed z-50 w-80 max-h-60 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-xl animate-in slide-in-from-top-2 duration-200"
      style={{
        top: position?.top || 'auto',
        left: position?.left || 0,
        bottom: position?.bottom || 'auto',
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1), 0 4px 6px rgba(0, 0, 0, 0.05)'
      }}
    >
      <div className="p-2">
        <div className="text-xs text-gray-500 mb-2 px-2 py-1 bg-gray-50 rounded-t-lg border-b border-gray-100">
          💬 Select a client to mention
        </div>
        {filteredClients.map((client, index) => (
          <div
            key={client.id}
            className={`flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors ${
              index === selectedIndex 
                ? 'bg-blue-50 border border-blue-200' 
                : 'hover:bg-gray-50'
            }`}
            onClick={() => onSelect(client)}
          >
            <Avatar className="w-8 h-8">
              <AvatarFallback className="bg-blue-100 text-blue-600">
                <User className="w-4 h-4" />
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm text-gray-900 truncate">
                {client.name}
              </div>
              <div className="text-xs text-gray-500 truncate">
                {client.email}
              </div>
            </div>
            {client.status && (
              <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                client.status === 'active' 
                  ? 'bg-green-100 text-green-700'
                  : client.status === 'prospect'
                  ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-gray-100 text-gray-700'
              }`}>
                {client.status}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
