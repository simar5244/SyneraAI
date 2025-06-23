"use client";

interface Skill {
  name: string;
  level: number;
}

interface Project {
  id: string;
  name: string;
  role: string;
}

interface User {
  id: string;
  name: string;
  role: string;
  teamId?: string;
  teamName?: string;
  managerId?: string;
  managerName?: string;
  skills: Skill[];
  projects: Project[];
  workload: number;
  responsibilities: string[];
}

interface UserDetailsPanelProps {
  user: User | null;
  onClose: () => void;
}

const UserDetailsPanel = ({ user, onClose }: UserDetailsPanelProps) => {
  if (!user) return null;

  const getWorkloadColor = (workload: number) => {
    if (workload > 90) return "bg-red-500";
    if (workload > 75) return "bg-orange-500";
    if (workload > 60) return "bg-yellow-500";
    if (workload < 30) return "bg-blue-500";
    return "bg-green-500";
  };

  const renderSkillLevel = (level: number) => {
    const dots = [];
    for (let i = 1; i <= 5; i++) {
      dots.push(
        <div
          key={i}
          className={`w-2 h-2 rounded-full ${
            i <= level ? "bg-blue-600" : "bg-gray-300"
          }`}
        />
      );
    }
    return <div className="flex space-x-1">{dots}</div>;
  };

  return (
    <div className="border rounded-lg shadow-sm bg-white overflow-hidden">
      <div className="bg-gray-50 p-4 border-b flex justify-between items-center">
        <h3 className="font-medium">Employee Details</h3>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700"
        >
          Close
        </button>
      </div>

      <div className="p-4 space-y-4">
        <div className="flex items-center space-x-3">
          <div className="h-12 w-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-lg font-medium">
            {user.name.split(' ').map(n => n[0]).join('')}
          </div>
          <div>
            <h3 className="font-medium text-lg">{user.name}</h3>
            <p className="text-sm text-gray-600">{user.role}</p>
          </div>
        </div>

        <div className="border-t pt-4">
          <div className="text-sm text-gray-700 mb-2">Current workload</div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full ${getWorkloadColor(user.workload)}`}
              style={{ width: `${user.workload}%` }}
            />
          </div>
          <div className="text-right text-xs mt-1 text-gray-500">
            {user.workload}%
          </div>
        </div>

        {user.teamName && (
          <div className="flex justify-between border-t pt-4">
            <div className="text-sm text-gray-700">Team</div>
            <div className="text-sm font-medium">{user.teamName}</div>
          </div>
        )}

        {user.managerName && (
          <div className="flex justify-between border-t pt-4">
            <div className="text-sm text-gray-700">Reports to</div>
            <div className="text-sm font-medium">{user.managerName}</div>
          </div>
        )}

        {user.skills && user.skills.length > 0 && (
          <div className="border-t pt-4">
            <div className="text-sm text-gray-700 mb-2">Skills</div>
            <div className="space-y-2">
              {user.skills.map((skill, index) => (
                <div key={index} className="flex justify-between items-center">
                  <span className="text-sm">{skill.name}</span>
                  {renderSkillLevel(skill.level)}
                </div>
              ))}
            </div>
          </div>
        )}

        {user.projects && user.projects.length > 0 && (
          <div className="border-t pt-4">
            <div className="text-sm text-gray-700 mb-2">Projects</div>
            <div className="space-y-2">
              {user.projects.map((project) => (
                <div
                  key={project.id}
                  className="bg-gray-50 p-2 rounded text-sm"
                >
                  <div className="font-medium">{project.name}</div>
                  <div className="text-xs text-gray-500">{project.role}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {user.responsibilities && user.responsibilities.length > 0 && (
          <div className="border-t pt-4">
            <div className="text-sm text-gray-700 mb-2">Responsibilities</div>
            <ul className="list-disc ml-5 text-sm space-y-1">
              {user.responsibilities.map((resp, index) => (
                <li key={index}>{resp}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserDetailsPanel; 